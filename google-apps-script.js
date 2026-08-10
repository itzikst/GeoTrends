/**
 * Google Apps Script: Google Drive Table of Contents Generator (Read-only / stdout version)
 * 
 * Instructions:
 * 1. Go to https://script.google.com
 * 2. Create a new project.
 * 3. Replace the default code with this script.
 * 4. Update the `FOLDER_URL` variable below with your Google Drive folder link.
 * 5. (To restrict access) Click the Gear Icon (Project Settings) on the left, check
 *    "Show 'appsscript.json' manifest file in editor", then in the editor set:
 *    "oauthScopes": ["https://www.googleapis.com/auth/drive.readonly"]
 * 6. Select the `generateTOC` function in the dropdown and click "Run".
 * 7. Grant the necessary permissions (it will only ask to view/read).
 * 8. Copy the generated Markdown table from the execution logs.
 */

// CHANGE THIS TO YOUR GOOGLE DRIVE FOLDER URL
const FOLDER_URL = 'https://drive.google.com/drive/folders/YOUR_FOLDER_ID_HERE';

/**
 * Main function to generate the Table of Contents.
 */
function generateTOC() {
  if (!FOLDER_URL || FOLDER_URL.includes('YOUR_FOLDER_ID_HERE')) {
    Logger.log('Error: Please update the FOLDER_URL variable with a valid Google Drive folder URL.');
    throw new Error('Please update the FOLDER_URL variable with a valid Google Drive folder URL.');
  }

  const folderId = extractFolderId(FOLDER_URL);
  if (!folderId) {
    Logger.log('Error: Invalid Google Drive folder URL.');
    throw new Error('Invalid Google Drive folder URL.');
  }

  Logger.log('Fetching folder contents recursively...');
  const rootFolder = DriveApp.getFolderById(folderId);
  const filesList = [];
  
  // Traverse starting from the root folder
  traverseFolder(rootFolder, filesList, rootFolder.getName());
  
  Logger.log(`Found ${filesList.length} files. Outputting Table of Contents below:\n`);
  
  // Build and print the Markdown Table
  const markdownTable = generateMarkdownTable(rootFolder.getName(), filesList);
  console.log(markdownTable);
}

/**
 * Extract Folder ID from the Drive Folder URL.
 */
function extractFolderId(url) {
  // Matches IDs in format: .../folders/ID or ...?id=ID
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

/**
 * Recursively list all files and subfolders.
 */
function traverseFolder(folder, filesList, currentPath) {
  // Get all files in the current folder
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    filesList.push({
      name: file.getName(),
      url: file.getUrl(),
      path: currentPath,
      mimeType: file.getMimeType()
    });
  }

  // Recursively traverse all subfolders
  const subfolders = folder.getFolders();
  while (subfolders.hasNext()) {
    const subfolder = subfolders.next();
    traverseFolder(subfolder, filesList, currentPath + ' / ' + subfolder.getName());
  }
}

/**
 * Format the files list as a Markdown table.
 */
function generateMarkdownTable(rootFolderName, filesList) {
  let table = `# Table of Contents - ${rootFolderName}\n\n`;
  table += `*Generated on: ${new Date().toLocaleDateString()}*\n`;
  table += `*Total files found: ${filesList.length}*\n\n`;
  
  if (filesList.length === 0) {
    table += '_No files found in the specified folder._\n';
    return table;
  }

  table += '| File Name | Folder Path | Type |\n';
  table += '| :--- | :--- | :--- |\n';

  filesList.forEach(file => {
    const cleanName = file.name.replace(/\|/g, '\\|'); // Escape vertical bars in markdown table
    const extension = getFileExtension(file.name, file.mimeType);
    table += `| [${cleanName}](${file.url}) | ${file.path} | ${extension} |\n`;
  });

  return table;
}

/**
 * Helper to determine a user-friendly file extension or format type.
 */
function getFileExtension(filename, mimeType) {
  // Check mime-type shortcuts
  if (mimeType.includes('google-apps.document')) return 'Google Doc';
  if (mimeType.includes('google-apps.spreadsheet')) return 'Google Sheet';
  if (mimeType.includes('google-apps.presentation')) return 'Google Slide';
  if (mimeType.includes('google-apps.folder')) return 'Folder';
  if (mimeType.includes('pdf')) return 'PDF';
  
  // Extract extension from filename
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex !== -1 && dotIndex < filename.length - 1) {
    return filename.substring(dotIndex + 1).toUpperCase();
  }
  
  return 'Unknown';
}
