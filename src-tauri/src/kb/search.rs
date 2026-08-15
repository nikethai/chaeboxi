//! Keyword scoring, cosine similarity, and RRF hybrid fusion.

use serde_json::{json, Value};

pub const SEARCH_TOP_N: usize = 20;
pub const RRF_K: f64 = 60.0;

#[derive(Debug, Clone)]
pub struct SearchCandidate {
    pub file_id: i64,
    pub filename: String,
    pub mime_type: String,
    pub chunk_index: i64,
    pub text: String,
    pub embedding: Option<Vec<f32>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct DocKey {
    pub file_id: i64,
    pub chunk_index: i64,
}

/// Original keyword scorer. Kept as-is so hybrid search can fuse with it.
pub fn score_search_text(query_lower: &str, query_terms: &[String], text: &str) -> f64 {
    if text.is_empty() || query_terms.is_empty() {
        return 0.0;
    }

    let text_lower = text.to_ascii_lowercase();
    let term_hits = query_terms
        .iter()
        .filter(|term| text_lower.contains(term.as_str()))
        .count();

    if term_hits == 0 && !text_lower.contains(query_lower) {
        return 0.0;
    }

    let mut score = term_hits as f64 / query_terms.len() as f64;
    if text_lower.contains(query_lower) {
        score += 0.5;
    }
    score
}

pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f64 {
    if a.is_empty() || b.is_empty() || a.len() != b.len() {
        return 0.0;
    }
    let mut dot = 0.0f64;
    let mut na = 0.0f64;
    let mut nb = 0.0f64;
    for (x, y) in a.iter().zip(b.iter()) {
        let xf = f64::from(*x);
        let yf = f64::from(*y);
        dot += xf * yf;
        na += xf * xf;
        nb += yf * yf;
    }
    let denom = na.sqrt() * nb.sqrt();
    if denom == 0.0 {
        0.0
    } else {
        dot / denom
    }
}

/// Reciprocal rank fusion. `k` is the RRF constant (typically 60).
/// Returns fused keys sorted by descending RRF score, truncated to `top_n`.
pub fn rrf_fuse(ranked_lists: &[Vec<DocKey>], k: f64, top_n: usize) -> Vec<(DocKey, f64)> {
    use std::collections::HashMap;
    let mut scores: HashMap<(i64, i64), (DocKey, f64)> = HashMap::new();
    for list in ranked_lists {
        for (rank, key) in list.iter().enumerate() {
            let add = 1.0 / (k + (rank as f64) + 1.0);
            let entry = scores
                .entry((key.file_id, key.chunk_index))
                .or_insert((*key, 0.0));
            entry.1 += add;
        }
    }
    let mut fused: Vec<(DocKey, f64)> = scores.into_values().collect();
    fused.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    fused.truncate(top_n);
    fused
}

const KEYWORD_STOPWORDS: &[&str] = &[
    "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "is", "are",
];

pub fn query_terms(query: &str) -> (String, Vec<String>) {
    let query_lower = query.to_ascii_lowercase();
    let terms: Vec<String> = query_lower
        .split_whitespace()
        .map(str::trim)
        .filter(|term| !term.is_empty() && term.len() > 1 && !KEYWORD_STOPWORDS.contains(term))
        .map(std::string::ToString::to_string)
        .collect();
    (query_lower, terms)
}

/// Hybrid search: keyword + optional vector, fused with RRF.
/// If `query_embedding` is None or no chunk has an embedding, keyword-only.
pub fn hybrid_search(
    query: &str,
    query_embedding: Option<&[f32]>,
    candidates: &[SearchCandidate],
) -> Vec<Value> {
    let (query_lower, terms) = query_terms(query);

    let mut keyword_scored: Vec<(f64, usize)> = Vec::new();
    for (idx, cand) in candidates.iter().enumerate() {
        let score = score_search_text(&query_lower, &terms, &cand.text);
        if score > 0.0 {
            keyword_scored.push((score, idx));
        }
    }
    keyword_scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

    let keyword_keys: Vec<DocKey> = keyword_scored
        .iter()
        .map(|(_, idx)| DocKey {
            file_id: candidates[*idx].file_id,
            chunk_index: candidates[*idx].chunk_index,
        })
        .collect();

    let mut vector_keys: Vec<DocKey> = Vec::new();
    let use_vector = query_embedding
        .map(|q| !q.is_empty())
        .unwrap_or(false)
        && candidates.iter().any(|c| c.embedding.is_some());

    if use_vector {
        if let Some(q) = query_embedding {
            let mut vec_scored: Vec<(f64, usize)> = Vec::new();
            for (idx, cand) in candidates.iter().enumerate() {
                if let Some(emb) = cand.embedding.as_deref() {
                    let score = cosine_similarity(q, emb);
                    if score > 0.0 {
                        vec_scored.push((score, idx));
                    }
                }
            }
            vec_scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
            vector_keys = vec_scored
                .iter()
                .map(|(_, idx)| DocKey {
                    file_id: candidates[*idx].file_id,
                    chunk_index: candidates[*idx].chunk_index,
                })
                .collect();
        }
    }

    let fused = if vector_keys.is_empty() {
        keyword_keys
            .into_iter()
            .take(SEARCH_TOP_N)
            .map(|key| (key, 0.0))
            .collect::<Vec<_>>()
    } else if keyword_keys.is_empty() {
        vector_keys
            .into_iter()
            .take(SEARCH_TOP_N)
            .map(|key| (key, 0.0))
            .collect::<Vec<_>>()
    } else {
        rrf_fuse(&[keyword_keys, vector_keys], RRF_K, SEARCH_TOP_N)
    };

    let mut rows = Vec::new();
    for (key, rrf_score) in fused {
        let Some(cand) = candidates.iter().find(|c| {
            c.file_id == key.file_id && c.chunk_index == key.chunk_index
        }) else {
            continue;
        };
        let keyword = score_search_text(&query_lower, &terms, &cand.text);
        let vector = match (query_embedding, cand.embedding.as_deref()) {
            (Some(q), Some(e)) => cosine_similarity(q, e),
            _ => 0.0,
        };
        // Prefer a visible score: RRF when fused, else the raw signal used.
        let score = if rrf_score > 0.0 {
            rrf_score
        } else if vector > 0.0 {
            vector
        } else {
            keyword
        };
        rows.push(json!({
            "id": cand.file_id.saturating_mul(1_000_000) + cand.chunk_index,
            "score": score,
            "text": cand.text,
            "fileId": cand.file_id,
            "filename": cand.filename,
            "mimeType": cand.mime_type,
            "chunkIndex": cand.chunk_index
        }));
    }
    rows
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key(file_id: i64, chunk_index: i64) -> DocKey {
        DocKey {
            file_id,
            chunk_index,
        }
    }

    #[test]
    fn rrf_prefers_items_high_in_both_lists() {
        let a = vec![key(1, 0), key(2, 0), key(3, 0)];
        let b = vec![key(3, 0), key(1, 0), key(4, 0)];
        let fused = rrf_fuse(&[a, b], 60.0, 4);
        assert_eq!(fused[0].0, key(1, 0), "doc 1 is rank 1 + rank 2");
        let ids: Vec<(i64, i64)> = fused.iter().map(|(k, _)| (k.file_id, k.chunk_index)).collect();
        assert!(ids.contains(&(3, 0)));
        assert!(ids.contains(&(2, 0)));
        assert!(ids.contains(&(4, 0)));
    }

    #[test]
    fn keyword_fallback_when_no_embeddings() {
        let candidates = vec![
            SearchCandidate {
                file_id: 1,
                filename: "a.txt".into(),
                mime_type: "text/plain".into(),
                chunk_index: 0,
                text: "the quick brown fox".into(),
                embedding: None,
            },
            SearchCandidate {
                file_id: 1,
                filename: "a.txt".into(),
                mime_type: "text/plain".into(),
                chunk_index: 1,
                text: "unrelated gardening notes".into(),
                embedding: None,
            },
        ];
        let rows = hybrid_search("brown fox", None, &candidates);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["chunkIndex"], 0);
        assert!(rows[0]["text"].as_str().unwrap().contains("fox"));
    }

    #[test]
    fn vietnamese_paraphrase_hits_with_fake_vectors() {
        // No shared keywords between the Vietnamese passage and the English query.
        let target = SearchCandidate {
            file_id: 7,
            filename: "vn.txt".into(),
            mime_type: "text/plain".into(),
            chunk_index: 0,
            text: "Mèo ngồi trên tấm thảm trong phòng khách.".into(),
            embedding: Some(vec![1.0, 0.0, 0.0, 0.0]),
        };
        let distractors: Vec<SearchCandidate> = (1..8)
            .map(|i| SearchCandidate {
                file_id: 8,
                filename: "en.txt".into(),
                mime_type: "text/plain".into(),
                chunk_index: i,
                text: format!("Quarterly revenue rose after the bank reported earnings {i}."),
                embedding: Some(vec![0.0, 1.0, 0.0, 0.0]),
            })
            .collect();
        let mut candidates = vec![target];
        candidates.extend(distractors);

        let query = "a feline resting on the living-room rug";
        let query_vec = vec![0.96, 0.05, 0.0, 0.0];
        let rows = hybrid_search(query, Some(&query_vec), &candidates);
        assert!(!rows.is_empty(), "hybrid search should return vector hits");
        let top5: Vec<i64> = rows.iter().take(5).map(|r| r["fileId"].as_i64().unwrap()).collect();
        assert!(
            top5.contains(&7),
            "Vietnamese chunk should be in top 5, got {:?}",
            rows.iter().take(5).collect::<Vec<_>>()
        );
        assert_eq!(rows[0]["fileId"], 7);
        assert_eq!(rows[0]["chunkIndex"], 0);
    }

    #[test]
    fn cosine_identical_is_one() {
        let v = vec![0.2, 0.4, 0.4];
        let s = cosine_similarity(&v, &v);
        assert!((s - 1.0).abs() < 1e-6);
    }
}
