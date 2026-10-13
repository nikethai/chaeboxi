# Explicit knowledge source connections

Users connect knowledge sources beforehand in Settings, assign their scope, and separately choose whether each source permits background memory review. The connection permits ongoing reading within that scope without repeated per-lookup approval; Chaeboxi does not automatically discover and ingest other agents' histories. This gives the user control over what is searchable and what can generate proposals, while preserving quick access after setup.

Reading permission does not make source contents authoritative. Background memory review prepares proposals under the user-approval policy; disabling it leaves the source searchable. The default toggle value and source removal behavior remain undecided.

Relevant source excerpts may reach the user's selected model provider by default. Each knowledge source can instead be marked local-only so its material is not sent to cloud services. This boundary applies to source processing, including background memory review, as well as answer generation; the eligible processing and fallback behavior require further design.

Local model use is optional. For a local-only source, the user may explicitly allow the selected cloud provider for the current request only, without changing the source's default or permitting future background processing. Explain this choice with a tooltip; show the provider and affected source with the action so the disclosure does not depend solely on hover. Proposed tooltip: "Send relevant excerpts from this source to {provider} for this request only. This source stays local-only for future requests."
