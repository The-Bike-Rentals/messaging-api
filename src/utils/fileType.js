/**
 * File type utilities
 * Maps extensions → { mimetype, messageType }
 */
const EXTENSION_MAP = {
  // Images
  jpg:  { mimetype: 'image/jpeg',     messageType: 'image' },
  jpeg: { mimetype: 'image/jpeg',     messageType: 'image' },
  png:  { mimetype: 'image/png',      messageType: 'image' },
  gif:  { mimetype: 'image/gif',      messageType: 'image' },
  webp: { mimetype: 'image/webp',     messageType: 'image' },
  bmp:  { mimetype: 'image/bmp',      messageType: 'image' },
  heic: { mimetype: 'image/heic',     messageType: 'image' },
  heif: { mimetype: 'image/heif',     messageType: 'image' },

  // Video
  mp4:  { mimetype: 'video/mp4',      messageType: 'video' },
  mov:  { mimetype: 'video/quicktime',messageType: 'video' },
  avi:  { mimetype: 'video/x-msvideo',messageType: 'video' },
  mkv:  { mimetype: 'video/x-matroska',messageType: 'video' },
  webm: { mimetype: 'video/webm',     messageType: 'video' },
  '3gp':{ mimetype: 'video/3gpp',     messageType: 'video' },

  // Audio
  mp3:  { mimetype: 'audio/mpeg',     messageType: 'audio' },
  ogg:  { mimetype: 'audio/ogg',      messageType: 'audio' },
  wav:  { mimetype: 'audio/wav',      messageType: 'audio' },
  m4a:  { mimetype: 'audio/mp4',      messageType: 'audio' },
  aac:  { mimetype: 'audio/aac',      messageType: 'audio' },
  opus: { mimetype: 'audio/opus',     messageType: 'audio' },
  amr:  { mimetype: 'audio/amr',      messageType: 'audio' },

  // Documents
  pdf:  { mimetype: 'application/pdf',                                                        messageType: 'document' },
  doc:  { mimetype: 'application/msword',                                                     messageType: 'document' },
  docx: { mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',messageType: 'document' },
  xls:  { mimetype: 'application/vnd.ms-excel',                                               messageType: 'document' },
  xlsx: { mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',      messageType: 'document' },
  ppt:  { mimetype: 'application/vnd.ms-powerpoint',                                          messageType: 'document' },
  pptx: { mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', messageType: 'document' },
  csv:  { mimetype: 'text/csv',                                                                messageType: 'document' },
  txt:  { mimetype: 'text/plain',                                                              messageType: 'document' },
  zip:  { mimetype: 'application/zip',                                                         messageType: 'document' },
  rar:  { mimetype: 'application/x-rar-compressed',                                            messageType: 'document' },
  '7z': { mimetype: 'application/x-7z-compressed',                                             messageType: 'document' },
  json: { mimetype: 'application/json',                                                        messageType: 'document' },
  xml:  { mimetype: 'application/xml',                                                         messageType: 'document' },
};

/**
 * Detect messageType and mimetype from a filename/originalname.
 * @param {string} filename
 * @param {string} [fallbackMimetype]
 * @returns {{ messageType: string, mimetype: string }}
 */
function detectFileType(filename, fallbackMimetype = 'application/octet-stream') {
  const ext = (filename || '').split('.').pop().toLowerCase();
  const match = EXTENSION_MAP[ext];
  if (match) return { ...match };
  // Try to guess from mimetype
  if (fallbackMimetype.startsWith('image/')) return { messageType: 'image', mimetype: fallbackMimetype };
  if (fallbackMimetype.startsWith('video/')) return { messageType: 'video', mimetype: fallbackMimetype };
  if (fallbackMimetype.startsWith('audio/')) return { messageType: 'audio', mimetype: fallbackMimetype };
  return { messageType: 'document', mimetype: fallbackMimetype };
}

module.exports = { detectFileType, EXTENSION_MAP };
