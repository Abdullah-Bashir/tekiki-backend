export const extractPublicId = (url) => {
    if (!url) return null;

    // Matches: /upload/v1234567890/folder/subfolder/file.ext
    const matches = url.match(/\/upload\/v\d+\/(.+?)\./);
    if (matches && matches[1]) {
        return matches[1];
    }

    // Fallback: last filename without extension
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename.split('.')[0];
};
