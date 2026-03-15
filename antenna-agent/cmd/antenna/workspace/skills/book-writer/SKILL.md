---
name: book-writer
description: Write, organize, and publish books with chapter management
version: 1.0.0
---

# Book Writer Skill

Write and publish books with chapter organization and multi-platform publishing.

## Setup

Books are stored in `~/.antenna/books/` as markdown files.

## Tools

[[tool]]
name: book_create
description: Create a new book project
params:
  - name: title
    type: string
    required: true
    description: Book title
  - name: author
    type: string
    required: false
    description: Author name
  - name: genre
    type: string
    required: false
    description: Genre (fiction, non-fiction, sci-fi, etc)

[[tool]]
name: book_add_chapter
description: Add a new chapter to a book
params:
  - name: book
    type: string
    required: true
    description: Book title
  - name: chapter
    type: string
    required: true
    description: Chapter title
  - name: content
    type: string
    required: false
    description: Initial chapter content

[[tool]]
name: book_write
description: Write or append content to a chapter
params:
  - name: book
    type: string
    required: true
    description: Book title
  - name: chapter
    type: string
    required: true
    description: Chapter title
  - name: content
    type: string
    required: true
    description: Content to write
  - name: mode
    type: string
    required: false
    description: append, prepend, or overwrite

[[tool]]
name: book_list
description: List all books and their chapters
params: []

[[tool]]
name: book_read
description: Read book or chapter content
params:
  - name: book
    type: string
    required: true
    description: Book title
  - name: chapter
    type: string
    required: false
    description: Chapter title (optional)

[[tool]]
name: book_outline
description: Generate a book outline/structure
params:
  - name: topic
    type: string
    required: true
    description: Book topic or idea
  - name: chapters
    type: number
    required: false
    description: Number of chapters (default 10)

[[tool]]
name: book_publish
description: Publish book to platforms
params:
  - name: book
    type: string
    required: true
    description: Book title
  - name: format
    type: string
    required: false
    description: Format: epub, pdf, html, markdown

[[tool]]
name: book_wordcount
description: Get word count for book or chapter
params:
  - name: book
    type: string
    required: true
    description: Book title
  - name: chapter
    type: string
    required: false
    description: Chapter title

## Script

const BOOKS_DIR = home() + "/.antenna/books";

async function book_create({ title, author = "", genre = "" }) {
  const { exec } = await import('child_process');
  const fs = await import('fs');
  
  const dir = BOOKS_DIR + "/" + title.replace(/[^a-zA-Z0-9]/g, "_");
  fs.mkdirSync(dir, { recursive: true });
  
  const meta = { title, author, genre, created: new Date().toISOString(), chapters: [] };
  fs.writeFileSync(dir + "/meta.json", JSON.stringify(meta, null, 2));
  
  return { success: true, book: title, path: dir };
}

async function book_add_chapter({ book, chapter, content = "" }) {
  const { exec } = await import('child_process');
  const fs = await import('fs');
  
  const dir = BOOKS_DIR + "/" + book.replace(/[^a-zA-Z0-9]/g, "_");
  const chapterFile = dir + "/" + chapter.replace(/[^a-zA-Z0-9]/g, "_") + ".md";
  
  fs.writeFileSync(chapterFile, "# " + chapter + "\n\n" + content);
  
  const metaPath = dir + "/meta.json";
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath));
    meta.chapters = meta.chapters || [];
    meta.chapters.push({ title: chapter, file: chapterFile + ".md" });
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  }
  
  return { success: true, chapter, file: chapterFile };
}

async function book_write({ book, chapter, content, mode = "append" }) {
  const { exec } = await import('child_process');
  const fs = await import('fs');
  
  const dir = BOOKS_DIR + "/" + book.replace(/[^a-zA-Z0-9]/g, "_");
  const chapterFile = dir + "/" + chapter.replace(/[^a-zA-Z0-9]/g, "_") + ".md";
  
  let existing = "";
  if (mode === "append" && fs.existsSync(chapterFile)) {
    existing = fs.readFileSync(chapterFile, "utf8") + "\n\n";
  }
  
  fs.writeFileSync(chapterFile, existing + content);
  const words = content.split(/\s+/).length;
  
  return { success: true, words, mode };
}

async function book_list() {
  const fs = await import('fs');
  
  if (!fs.existsSync(BOOKS_DIR)) {
    return { books: [] };
  }
  
  const books = fs.readdirSync(BOOKS_DIR).filter(f => {
    return fs.statSync(BOOKS_DIR + "/" + f).isDirectory();
  });
  
  const result = [];
  for (const book of books) {
    const metaFile = BOOKS_DIR + "/" + book + "/meta.json";
    let meta = { title: book, chapters: [] };
    if (fs.existsSync(metaFile)) {
      meta = JSON.parse(fs.readFileSync(metaFile));
    }
    result.push(meta);
  }
  
  return { books: result };
}

async function book_read({ book, chapter = "" }) {
  const fs = await import('fs');
  
  const dir = BOOKS_DIR + "/" + book.replace(/[^a-zA-Z0-9]/g, "_");
  
  if (chapter) {
    const chapterFile = dir + "/" + chapter.replace(/[^a-zA-Z0-9]/g, "_") + ".md";
    if (fs.existsSync(chapterFile)) {
      return { book, chapter, content: fs.readFileSync(chapterFile, "utf8") };
    }
    return { error: "Chapter not found" };
  }
  
  // Return entire book
  const metaFile = dir + "/meta.json";
  let meta = {};
  if (fs.existsSync(metaFile)) {
    meta = JSON.parse(fs.readFileSync(metaFile));
  }
  
  let fullContent = "# " + book + "\n\n";
  const chapters = meta.chapters || [];
  for (const ch of chapters) {
    const chFile = ch.file || (dir + "/" + ch.title.replace(/[^a-zA-Z0-9]/g, "_") + ".md");
    if (fs.existsSync(chFile)) {
      fullContent += fs.readFileSync(chFile, "utf8") + "\n\n---\n\n";
    }
  }
  
  return { book, content: fullContent };
}

async function book_outline({ topic, chapters = 10 }) {
  const { stdout } = await exec(`echo 'Generating outline for: ${topic}'`);
  return { 
    topic, 
    chapters: chapters,
    note: "Use book_create to create book, then book_add_chapter for each outline section"
  };
}

async function book_publish({ book, format = "markdown" }) {
  const { book_read } = await import('./skills');
  const content = await book_read({ book });
  
  const dir = BOOKS_DIR + "/" + book.replace(/[^a-zA-Z0-9]/g, "_");
  const fs = await import('fs');
  
  const outputFile = dir + "/published." + format;
  fs.writeFileSync(outputFile, content.content || "");
  
  return { 
    success: true, 
    book, 
    format, 
    file: outputFile,
    note: "Export ready - upload to Kindle, Smashwords, or your preferred platform"
  };
}

async function book_wordcount({ book, chapter = "" }) {
  const fs = await import('fs');
  
  const dir = BOOKS_DIR + "/" + book.replace(/[^a-zA-Z0-9]/g, "_");
  let total = 0;
  
  if (chapter) {
    const chapterFile = dir + "/" + chapter.replace(/[^a-zA-Z0-9]/g, "_") + ".md";
    if (fs.existsSync(chapterFile)) {
      const content = fs.readFileSync(chapterFile, "utf8");
      total = content.split(/\s+/).filter(w => w.length > 0).length;
    }
  } else {
    const metaFile = dir + "/meta.json";
    let meta = {};
    if (fs.existsSync(metaFile)) {
      meta = JSON.parse(fs.readFileSync(metaFile));
    }
    for (const ch of meta.chapters || []) {
      const chFile = ch.file || (dir + "/" + ch.title.replace(/[^a-zA-Z0-9]/g, "_") + ".md");
      if (fs.existsSync(chFile)) {
        const content = fs.readFileSync(chFile, "utf8");
        total += content.split(/\s+/).filter(w => w.length > 0).length;
      }
    }
  }
  
  return { book, chapter: chapter || "all", words: total, estimated_pages: Math.ceil(total / 250) };
}
