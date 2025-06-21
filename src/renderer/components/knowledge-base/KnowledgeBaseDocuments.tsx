import {
  ActionIcon,
  Box,
  Button,
  Center,
  Collapse,
  Group,
  Loader,
  Paper,
  Pill,
  Progress,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconFile,
  IconLoader,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import type { KnowledgeBase } from 'src/shared/types'
import { useKnowledgeBaseFiles, useKnowledgeBaseFilesActions, useKnowledgeBaseFilesCount } from '@/hooks/knowledge-base'
import { useChunksPreview } from '@/hooks/useChunksPreview'
import platform from '@/platform'
import ChunksPreviewModal from './ChunksPreviewModal'

interface KnowledgeBaseDocumentsProps {
  knowledgeBase: KnowledgeBase | null
}

const KnowledgeBaseDocuments: React.FC<KnowledgeBaseDocumentsProps> = ({ knowledgeBase }) => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [showScrollIndicator, setShowScrollIndicator] = React.useState(true)
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [showUploadArea, setShowUploadArea] = React.useState(false)

  const scrollAreaRef = React.useRef<HTMLDivElement>(null)

  // Chunks preview hook
  const chunksPreview = useChunksPreview()

  // Fetch files data using react-query
  const {
    data: filesData,
    fetchNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useKnowledgeBaseFiles(knowledgeBase?.id || null)

  const { data: filesCount = 0, refetch: refetchCount } = useKnowledgeBaseFilesCount(knowledgeBase?.id || null)
  const { invalidateFiles } = useKnowledgeBaseFilesActions()

  // Flatten all pages of files into a single array
  const allFiles = React.useMemo(() => {
    return filesData?.pages.flatMap((page) => page.files) || []
  }, [filesData])

  // Real-time polling for file status updates
  React.useEffect(() => {
    if (!knowledgeBase?.id || allFiles.length === 0) return

    // Check if there are any files being processed
    const hasProcessingFiles = allFiles.some(
      (file) => file.status === 'pending' || file.status === 'processing' || file.status === 'paused'
    )

    if (!hasProcessingFiles) return

    // Poll every 2 seconds when there are processing files
    const pollInterval = setInterval(() => {
      refetch()
      refetchCount()
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [knowledgeBase?.id, allFiles, refetch, refetchCount])

  // Calculate height for exactly 5 document items (each item ~60px + gaps)
  const maxHeight = 5 * 60 // 5 items * 60px

  // Handle scroll position change
  const handleScrollPositionChange = React.useCallback((position: { x: number; y: number }) => {
    setShowScrollIndicator(true)
  }, [])

  const handleScrollToBottom = React.useCallback(() => {
    setShowScrollIndicator(false)
    fetchNextPage()
  }, [fetchNextPage])

  // Update scroll indicator when documents change
  React.useEffect(() => {
    setShowScrollIndicator(allFiles.length > 5)
  }, [allFiles.length])

  // Get supported file types
  const getSupportedFileTypes = React.useCallback(() => {
    const documentTypes = [
      '.pdf',
      '.doc',
      '.docx',
      '.txt',
      '.md',
      '.rtf',
      '.ppt',
      '.pptx',
      '.xls',
      '.xlsx',
      '.csv',
      '.epub',
    ]
    const imageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp']
    const hasVisionModel = knowledgeBase?.visionModel && knowledgeBase.visionModel.trim() !== ''

    return {
      accept: hasVisionModel ? `${documentTypes.join(',')},${imageTypes.join(',')}` : documentTypes.join(','),
      display: hasVisionModel ? [...documentTypes, ...imageTypes] : documentTypes,
    }
  }, [knowledgeBase?.visionModel])

  // Handle file upload (shared logic)
  const uploadFiles = React.useCallback(
    async (files: FileList) => {
      if (!knowledgeBase?.id || !files.length) return

      console.log(`[Upload] Starting upload for ${files.length} files.`)

      const knowledgeBaseController = platform.getKnowledgeBaseController()
      await Promise.all(
        Array.from(files).map((file) => {
          console.log(`[Upload] Starting upload for file: ${file.name}`)
          return knowledgeBaseController.uploadFile(knowledgeBase.id, file)
        })
      )

      console.log(`[Upload] All files uploaded successfully.`)

      // Immediately refresh the data to show the new file
      await Promise.all([refetch(), refetchCount()])

      // Also invalidate cache for other components
      invalidateFiles(knowledgeBase.id)

      // Auto-expand to show the uploaded file (only if not already expanded)
      if (!isExpanded) {
        setIsExpanded(true)
      }
    },
    [knowledgeBase?.id, refetch, refetchCount, invalidateFiles, isExpanded]
  )

  // Handle drag and drop events
  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only hide drag over state if we're leaving the drop zone completely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = React.useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const files = e.dataTransfer.files
      if (files.length === 0) return

      try {
        await uploadFiles(files)
      } catch (error) {
        console.error('Failed to upload files via drag and drop:', error)
      }
    },
    [uploadFiles]
  )

  // Handle file deletion
  const handleDeleteFile = React.useCallback(
    async (fileId: number) => {
      try {
        const knowledgeBaseController = platform.getKnowledgeBaseController()
        await knowledgeBaseController.deleteFile(fileId)
        if (knowledgeBase?.id) {
          invalidateFiles(knowledgeBase.id)
        }
      } catch (error) {
        console.error('Failed to delete file:', error)
      }
    },
    [knowledgeBase?.id, invalidateFiles]
  )

  // Handle file retry
  const handleRetryFile = React.useCallback(
    async (fileId: number) => {
      try {
        const knowledgeBaseController = platform.getKnowledgeBaseController()
        await knowledgeBaseController.retryFile(fileId)
        if (knowledgeBase?.id) {
          // Refresh data to show updated status
          refetch()
          refetchCount()
          invalidateFiles(knowledgeBase.id)
        }
      } catch (error) {
        console.error('Failed to retry file:', error)
      }
    },
    [knowledgeBase?.id, refetch, refetchCount, invalidateFiles]
  )

  // Handle file pause
  const handlePauseFile = React.useCallback(
    async (fileId: number) => {
      try {
        const knowledgeBaseController = platform.getKnowledgeBaseController()
        await knowledgeBaseController.pauseFile(fileId)
        if (knowledgeBase?.id) {
          // Refresh data to show updated status
          refetch()
          refetchCount()
          invalidateFiles(knowledgeBase.id)
        }
      } catch (error) {
        console.error('Failed to pause file:', error)
      }
    },
    [knowledgeBase?.id, refetch, refetchCount, invalidateFiles]
  )

  // Handle file resume
  const handleResumeFile = React.useCallback(
    async (fileId: number) => {
      try {
        const knowledgeBaseController = platform.getKnowledgeBaseController()
        await knowledgeBaseController.resumeFile(fileId)
        if (knowledgeBase?.id) {
          // Refresh data to show updated status
          refetch()
          refetchCount()
          invalidateFiles(knowledgeBase.id)
        }
      } catch (error) {
        console.error('Failed to resume file:', error)
      }
    },
    [knowledgeBase?.id, refetch, refetchCount, invalidateFiles]
  )

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / k ** i).toFixed(1)) + ' ' + sizes[i]
  }

  // Format date
  const formatDate = (timestamp: number): string => {
    try {
      if (!timestamp || isNaN(timestamp)) {
        return 'Unknown date'
      }
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) {
        return 'Invalid date'
      }

      // Use local time and format
      const now = new Date()
      const isToday = date.toDateString() === now.toDateString()
      const isThisYear = date.getFullYear() === now.getFullYear()

      if (isToday) {
        // Show time only for today
        return date.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      } else if (isThisYear) {
        // Show month/day + time for this year
        return (
          date.toLocaleDateString([], {
            month: '2-digit',
            day: '2-digit',
          }) +
          ' ' +
          date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
        )
      } else {
        // Show full date for other years
        return (
          date.toLocaleDateString([], {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
          }) +
          ' ' +
          date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
        )
      }
    } catch (error) {
      console.error('Error formatting date:', timestamp, error)
      return 'Invalid date'
    }
  }

  const getStatusIcon = (status: string, error?: string) => {
    switch (status) {
      case 'completed':
      case 'done':
        return <IconCheck size={16} color="var(--mantine-color-green-6)" />
      case 'processing':
        return (
          <IconLoader
            size={16}
            color="var(--mantine-color-yellow-6)"
            style={{ animation: 'spin 1s linear infinite' }}
          />
        )
      case 'pending':
        return <IconLoader size={16} color="var(--mantine-color-gray-6)" />
      case 'paused':
        return <IconPlayerPause size={16} color="var(--mantine-color-orange-6)" />
      case 'failed':
        return (
          <Tooltip
            label={error || t('Processing failed')}
            multiline
            w={300}
            withArrow
            position="top"
            transitionProps={{ duration: 200 }}
          >
            <IconX size={16} color="var(--mantine-color-red-6)" style={{ cursor: 'help' }} />
          </Tooltip>
        )
      default:
        return null
    }
  }

  // Get progress percentage for display
  const getProgressPercentage = (chunkCount: number, totalChunks: number): number => {
    if (totalChunks === 0) return 0
    return Math.round((chunkCount / totalChunks) * 100)
  }

  // Handle file upload via button
  const handleAddFile = React.useCallback(async () => {
    if (!knowledgeBase?.id) return

    // Toggle upload area visibility
    setShowUploadArea(!showUploadArea)
    if (!showUploadArea) {
      setIsExpanded(true)
    }
  }, [knowledgeBase?.id, showUploadArea])

  // Handle file selection via file dialog
  const handleFileDialog = React.useCallback(async () => {
    if (!knowledgeBase?.id) return

    try {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true
      const { accept } = getSupportedFileTypes()
      input.accept = accept
      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files
        if (!files || !files.length) return

        await uploadFiles(files)
      }
      input.click()
    } catch (error) {
      console.error('Failed to upload file:', error)
    }
  }, [knowledgeBase?.id, getSupportedFileTypes, uploadFiles])

  const supportedTypes = getSupportedFileTypes()

  return (
    <Stack>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* Documents Section */}
      <Box>
        <Paper withBorder radius="sm" p={0}>
          {/* Documents Header */}
          <Group
            align="center"
            justify="space-between"
            px="sm"
            py="2px"
            style={{
              cursor: 'pointer',
              backgroundColor: 'var(--mantine-color-chatbox-background-secondary-text)',
              borderBottom: '1px solid var(--mantine-color-chatbox-border-secondary-light)',
            }}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Group>
              {isExpanded ? (
                <IconChevronDown size={16} color="var(--mantine-color-gray-6)" />
              ) : (
                <IconChevronRight size={16} color="var(--mantine-color-gray-6)" />
              )}
              <Text size="sm" fw={600} className="text-[var(--mantine-color-chatbox-primary-text)]">
                {t('Documents')}
              </Text>
              <Pill
                size="xs"
                bg={filesCount > 0 ? 'var(--mantine-color-chatbox-brand-light)' : 'var(--mantine-color-gray-2)'}
              >
                <Text
                  size="xs"
                  c={filesCount > 0 ? 'var(--mantine-color-chatbox-brand-filled)' : 'var(--mantine-color-gray-6)'}
                >
                  {filesCount}
                </Text>
              </Pill>
            </Group>
            <Button
              variant="subtle"
              color="var(--mantine-color-chatbox-primary-text)"
              size="xs"
              fw={600}
              leftSection={showUploadArea ? <IconX size={14} /> : <IconPlus size={14} />}
              onClick={(e) => {
                e.stopPropagation()
                handleAddFile()
              }}
            >
              {showUploadArea ? t('Cancel') : t('Add File')}
            </Button>
          </Group>

          <Collapse in={isExpanded}>
            {/* Drag and Drop Upload Area */}
            {showUploadArea && (
              <Box
                p="md"
                style={{
                  borderBottom: allFiles.length > 0 ? '1px solid var(--mantine-color-gray-2)' : 'none',
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Paper
                  withBorder
                  p="lg"
                  radius="md"
                  style={{
                    border: isDragOver
                      ? '2px dashed var(--mantine-color-blue-4)'
                      : '2px dashed var(--mantine-color-gray-3)',
                    backgroundColor: isDragOver ? 'var(--mantine-color-blue-0)' : 'var(--mantine-color-gray-0)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                  }}
                  onClick={handleFileDialog}
                >
                  <Stack align="center" gap="sm">
                    <IconUpload
                      size={32}
                      color={isDragOver ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-gray-6)'}
                    />
                    <Text size="sm" fw={500} ta="center" c={isDragOver ? 'blue' : 'dimmed'}>
                      {isDragOver ? t('Drop files here') : t('Drag and drop files here, or click to browse')}
                    </Text>
                    <Text size="xs" c="dimmed" ta="center" mt={-4}>
                      {t('Supported formats')}: {supportedTypes.display.join(', ')}
                    </Text>
                  </Stack>
                </Paper>
              </Box>
            )}

            {/* Scrollable Document List with Scroll Indicator */}
            {allFiles.length > 0 && (
              <Box style={{ position: 'relative' }}>
                <ScrollArea
                  ref={scrollAreaRef}
                  h={maxHeight}
                  type="scroll"
                  onScrollPositionChange={handleScrollPositionChange}
                  onBottomReached={handleScrollToBottom}
                >
                  <Stack gap={0}>
                    {allFiles.map((doc, index) => (
                      <Box key={doc.id}>
                        <Group
                          px="md"
                          py="sm"
                          justify="space-between"
                          align="center"
                          style={{
                            minHeight: 60,
                            borderBottom:
                              index < allFiles.length - 1 ? '1px solid var(--mantine-color-gray-2)' : 'none',
                          }}
                        >
                          <Group gap="sm" align="center" style={{ flex: 1 }}>
                            <IconFile size={20} color="var(--mantine-color-blue-6)" />
                            <Box style={{ flex: 1 }}>
                              <Text size="sm" fw={500} lineClamp={1}>
                                {doc.filename}
                              </Text>
                              <Group gap="md" mt={2}>
                                <Text size="xs" c="dimmed">
                                  {formatDate(doc.createdAt)}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {formatFileSize(doc.file_size)}
                                </Text>
                                {doc.status === 'done' && doc.chunk_count > 0 && (
                                  <Text
                                    size="xs"
                                    c="dimmed"
                                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      chunksPreview.openPreview(doc)
                                    }}
                                  >
                                    {doc.chunk_count} {t('chunks')}
                                  </Text>
                                )}
                                {(doc.status === 'processing' || doc.status === 'paused') && doc.total_chunks > 0 && (
                                  <Box style={{ flex: 1, minWidth: 100 }}>
                                    <Group gap="xs" align="center">
                                      <Text
                                        size="xs"
                                        c="dimmed"
                                        style={{ cursor: 'pointer' }}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          chunksPreview.openPreview(doc)
                                        }}
                                      >
                                        {doc.chunk_count}/{doc.total_chunks} {t('chunks')} (
                                        {getProgressPercentage(doc.chunk_count, doc.total_chunks)}%)
                                      </Text>
                                    </Group>
                                    <Progress
                                      value={getProgressPercentage(doc.chunk_count, doc.total_chunks)}
                                      size="xs"
                                      mt={2}
                                      color={doc.status === 'processing' ? 'blue' : 'orange'}
                                      radius="sm"
                                    />
                                  </Box>
                                )}
                              </Group>
                            </Box>
                          </Group>

                          <Group gap="sm" align="center">
                            {getStatusIcon(doc.status, doc.error)}
                            {doc.status === 'failed' && (
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                size="sm"
                                onClick={() => handleRetryFile(doc.id)}
                                title={t('Retry')}
                              >
                                <IconRefresh size={14} />
                              </ActionIcon>
                            )}
                            {doc.status === 'processing' && (
                              <ActionIcon
                                variant="subtle"
                                color="orange"
                                size="sm"
                                onClick={() => handlePauseFile(doc.id)}
                                title={t('Pause')}
                              >
                                <IconPlayerPause size={14} />
                              </ActionIcon>
                            )}
                            {doc.status === 'paused' && (
                              <ActionIcon
                                variant="subtle"
                                color="green"
                                size="sm"
                                onClick={() => handleResumeFile(doc.id)}
                                title={t('Resume')}
                              >
                                <IconPlayerPlay size={14} />
                              </ActionIcon>
                            )}
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              size="sm"
                              onClick={() => handleDeleteFile(doc.id)}
                              disabled={doc.status === 'processing'}
                              title={t('Delete')}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      </Box>
                    ))}

                    {/* Loading indicator for next page */}
                    {isFetchingNextPage && (
                      <Center p="md">
                        <Loader size="sm" />
                      </Center>
                    )}
                  </Stack>
                </ScrollArea>

                {/* Scroll Indicator Mask */}
                {showScrollIndicator && (
                  <Box
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 30,
                      background: 'linear-gradient(transparent, var(--mantine-color-body))',
                      pointerEvents: 'none',
                      zIndex: 1,
                    }}
                  />
                )}
              </Box>
            )}
            {/* Empty state or loading */}
            {isLoading && (
              <Center p="xl">
                <Loader size="lg" />
              </Center>
            )}
            {!isLoading && allFiles.length === 0 && (
              <Box p="xl">
                <Stack align="center" gap="sm">
                  <IconFile size={48} color="var(--mantine-color-gray-4)" />
                  <Text size="sm" c="dimmed" ta="center">
                    {t('No documents yet')}
                  </Text>
                  <Text size="xs" c="dimmed" ta="center">
                    {t('Upload your first document to get started')}
                  </Text>
                </Stack>
              </Box>
            )}
          </Collapse>
        </Paper>
      </Box>

      {/* Chunks Preview Modal */}
      <ChunksPreviewModal
        opened={chunksPreview.isOpen}
        onClose={chunksPreview.closePreview}
        file={chunksPreview.selectedFile}
        knowledgeBaseId={knowledgeBase?.id}
      />
    </Stack>
  )
}

export default KnowledgeBaseDocuments
