import { promises as fs } from 'fs';

const MEMORY_FILE = './memory.json';

export async function getMemory(ticker: string) {
  try {
    const data = await fs.readFile(MEMORY_FILE, 'utf-8');
    const memory = JSON.parse(data);
    return memory[ticker] || {};
  } catch (error: any) {
    if ('code' in error && error.code === 'ENOENT') {
      return {}; // Return empty object if file doesn't exist
    }
    console.error('Failed to read memory file:', error);
    return {};
  }
}

export async function saveMemory(key: string, value: string) {
  try {
    // 1. Read the entire file and parse the JSON.
    const data = await fs.readFile(MEMORY_FILE, 'utf-8');
    const memory = JSON.parse(data);

    // 2. Update the parsed memory object with the new key/value.
    memory[key] = value;

    // 3. Write the entire updated memory object back to the file.
    await fs.writeFile(MEMORY_FILE, JSON.stringify(memory, null, 2), 'utf-8');
  } catch (error: any) {
    // Handle the case where the file doesn't exist on the first save
    if ('code' in error && error.code === 'ENOENT') {
      const memory = { [key]: value };
      await fs.writeFile(MEMORY_FILE, JSON.stringify(memory, null, 2), 'utf-8');
    } else {
      console.error('Failed to save memory:', error);
    }
  }
}
