import * as fs from 'fs/promises';
import * as path from 'path';
import * as chokidar from 'chokidar';

export interface ObsidianNote {
  title: string;
  content: string;
  path: string;
  created: Date;
  modified: Date;
  tags: string[];
  links: string[];
}

export interface ObsidianVaultConfig {
  vaultPath: string;
  notesFolder?: string;
  syncInterval?: number;
}

export class ObsidianVaultService {
  private config: ObsidianVaultConfig;
  private watcher: chokidar.FSWatcher | null = null;
  private callbacks: ((note: ObsidianNote) => void)[] = [];

  constructor(config: ObsidianVaultConfig) {
    this.config = config;
  }

  /**
   * Get all notes from vault
   */
  async getAllNotes(): Promise<ObsidianNote[]> {
    const notesDir = path.join(
      this.config.vaultPath,
      this.config.notesFolder || 'conflict-globe'
    );

    try {
      await fs.access(notesDir);
    } catch {
      await fs.mkdir(notesDir, { recursive: true });
      return [];
    }

    const files = await fs.readdir(notesDir);
    const notes: ObsidianNote[] = [];

    for (const file of files) {
      if (file.endsWith('.md')) {
        const note = await this.readNote(file);
        if (note) notes.push(note);
      }
    }

    return notes;
  }

  /**
   * Read a single note
   */
  async readNote(filename: string): Promise<ObsidianNote | null> {
    const filePath = path.join(
      this.config.vaultPath,
      this.config.notesFolder || 'conflict-globe',
      filename
    );

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);

      // Extract tags
      const tags = [...content.matchAll(/#[\w-]+/g)].map(m => m[0]);
      
      // Extract wiki links
      const links = [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]);

      return {
        title: filename.replace('.md', ''),
        content,
        path: filePath,
        created: stats.birthtime,
        modified: stats.mtime,
        tags,
        links
      };
    } catch (error) {
      console.error(`Error reading note ${filename}:`, error);
      return null;
    }
  }

  /**
   * Create or update a note
   */
  async saveNote(title: string, content: string, tags?: string[]): Promise<ObsidianNote> {
    const filename = `${title.replace(/[^a-z0-9-]/gi, '-')}.md`;
    const filePath = path.join(
      this.config.vaultPath,
      this.config.notesFolder || 'conflict-globe',
      filename
    );

    // Add tags to content
    let finalContent = content;
    if (tags && tags.length > 0) {
      const tagLine = tags.map(t => t.startsWith('#') ? t : `#${t}`).join(' ');
      finalContent = `${tagLine}\n\n${content}`;
    }

    await fs.writeFile(filePath, finalContent, 'utf-8');
    
    return {
      title,
      content: finalContent,
      path: filePath,
      created: new Date(),
      modified: new Date(),
      tags: tags || [],
      links: []
    };
  }

  /**
   * Delete a note
   */
  async deleteNote(filename: string): Promise<boolean> {
    const filePath = path.join(
      this.config.vaultPath,
      this.config.notesFolder || 'conflict-globe',
      filename.endsWith('.md') ? filename : `${filename}.md`
    );

    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Search notes by content or tags
   */
  async searchNotes(query: string): Promise<ObsidianNote[]> {
    const notes = await this.getAllNotes();
    
    return notes.filter(note => {
      const contentMatch = note.content.toLowerCase().includes(query.toLowerCase());
      const tagMatch = note.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()));
      const titleMatch = note.title.toLowerCase().includes(query.toLowerCase());
      
      return contentMatch || tagMatch || titleMatch;
    });
  }

  /**
   * Watch for changes in vault
   */
  watch(callback: (note: ObsidianNote) => void): void {
    this.callbacks.push(callback);

    if (!this.watcher) {
      const notesDir = path.join(
        this.config.vaultPath,
        this.config.notesFolder || 'conflict-globe'
      );

      this.watcher = chokidar.watch(notesDir, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true
      });

      this.watcher.on('change', async (filePath) => {
        const filename = path.basename(filePath);
        const note = await this.readNote(filename);
        if (note) {
          this.callbacks.forEach(cb => cb(note));
        }
      });

      this.watcher.on('add', async (filePath) => {
        const filename = path.basename(filePath);
        const note = await this.readNote(filename);
        if (note) {
          this.callbacks.forEach(cb => cb(note));
        }
      });
    }
  }

  /**
   * Stop watching for changes
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Export vault to JSON
   */
  async exportToJSON(): Promise<any[]> {
    const notes = await this.getAllNotes();
    return notes.map(note => ({
      title: note.title,
      content: note.content,
      tags: note.tags,
      links: note.links,
      created: note.created.toISOString(),
      modified: note.modified.toISOString()
    }));
  }
}

export async function initObsidianVault(config: ObsidianVaultConfig): Promise<ObsidianVaultService> {
  const service = new ObsidianVaultService(config);
  
  // Ensure vault directory exists
  const vaultPath = path.join(config.vaultPath, config.notesFolder || 'conflict-globe');
  await fs.mkdir(vaultPath, { recursive: true });
  
  return service;
}
