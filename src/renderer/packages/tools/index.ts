import { t } from 'i18next'

export function getToolName(toolName: string): string {
  // Use translation keys that i18next cli can detect
  const toolNames: Record<string, string> = {
    query_knowledge_base: t('Query Knowledge Base'),
    get_files_meta: t('Get Files Meta'),
    read_file_chunks: t('Read File Chunks'),
    list_files: t('List Files'),
    web_search: t('Web Search'),
    file_search: t('File Search'),
    code_search: t('Code Search'),
    terminal: t('Terminal'),
    create_file: t('Create File'),
    edit_file: t('Edit File'),
    delete_file: t('Delete File'),
    parse_link: t('Parse Link'),
    read_video: t('Read Video'),
    read_video_url: t('Read Video URL'),
    generate_image: t('Generate Image'),
    create_task: t('Create Task'),
    update_task: t('Update Task'),
    list_tasks: t('List Tasks'),
    memory_lookup: t('Memory lookup'),
    memory_recall: t('Memory recall'),
    memory_retain: t('Memory retain'),
    memory_list: t('Memory list'),
    memory_forget: t('Memory forget'),
    memory_update: t('Memory update'),
    memory_reflect: t('Memory reflect'),
  }

  return toolNames[toolName] || toolName
}
