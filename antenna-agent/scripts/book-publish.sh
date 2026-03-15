#!/bin/bash
# Book Publishing Helper

BOOKS_DIR="$HOME/.antenna/books"
EPUB_GEN="pandoc"

usage() {
    echo "Usage: book-publish.sh <command> [args...]"
    echo ""
    echo "Commands:"
    echo "  convert <book> <format>   - Convert to epub/pdf/html"
    echo "  kindle <book>              - Send to Kindle (via email)"
    echo "  status <book>              - Show publishing status"
    echo "  platforms                  - List supported platforms"
    echo ""
    exit 1
}

cmd_convert() {
    local book="$1"
    local format="$2"
    local book_dir="$BOOKS_DIR/${book//[^a-zA-Z0-9]/_}"
    
    if [[ ! -d "$book_dir" ]]; then
        echo "Error: Book '$book' not found"
        return 1
    fi
    
    # Get metadata
    local author=""
    if [[ -f "$book_dir/meta.json" ]]; then
        author=$(jq -r '.author // "Unknown"' "$book_dir/meta.json")
    fi
    
    # Merge chapters
    local output="$book_dir/published.md"
    > "$output"
    
    echo "# $book" >> "$output"
    echo "" >> "$output"
    
    for ch in "$book_dir"/*.md; do
        if [[ "$(basename "$ch")" != "meta.json" && "$(basename "$ch")" != "published.md" ]]; then
            echo "" >> "$output"
            cat "$ch" >> "$output"
            echo "" >> "$output"
        fi
    done
    
    case "$format" in
        epub)
            if command -v pandoc &> /dev/null; then
                pandoc "$output" -o "$book_dir/$book.epub" --metadata title="$book" --metadata author="$author"
                echo "Created: $book_dir/$book.epub"
            else
                echo "Error: pandoc not installed (brew install pandoc)"
            fi
            ;;
        pdf)
            if command -v pandoc &> /dev/null; then
                pandoc "$output" -o "$book_dir/$book.pdf" --metadata title="$book" --metadata author="$author"
                echo "Created: $book_dir/$book.pdf"
            else
                echo "Error: pandoc not installed"
            fi
            ;;
        html)
            if command -v pandoc &> /dev/null; then
                pandoc "$output" -o "$book_dir/$book.html" --metadata title="$book"
                echo "Created: $book_dir/$book.html"
            else
                echo "Error: pandoc not installed"
            fi
            ;;
        *)
            echo "Supported formats: epub, pdf, html"
            ;;
    esac
}

cmd_status() {
    local book="$1"
    local book_dir="$BOOKS_DIR/${book//[^a-zA-Z0-9]/_}"
    
    if [[ ! -d "$book_dir" ]]; then
        echo "Error: Book '$book' not found"
        return 1
    fi
    
    echo "=== $book ==="
    if [[ -f "$book_dir/meta.json" ]]; then
        jq '.' "$book_dir/meta.json"
    fi
    
    echo ""
    echo "Files:"
    ls -la "$book_dir"/*.md "$book_dir"/*.epub "$book_dir"/*.pdf "$book_dir"/*.html 2>/dev/null || echo "No output files yet"
    
    echo ""
    echo "Word count:"
    wc -w "$book_dir"/*.md 2>/dev/null | tail -1
}

cmd_platforms() {
    echo "=== Supported Publishing Platforms ==="
    echo ""
    echo "Direct Upload:"
    echo "  - Amazon Kindle Direct Publishing (kdp.amazon.com)"
    echo "  - Smashwords (smashwords.com  - Draft2Digital (draft2digital.com)"
)"
    echo "    echo "  - Google Play Books"
    echo ""
    echo "Self-Publish:"
    echo "  - Gumroad (gumroad.com) - for direct sales"
    echo "  - Leanpub (leanpub.com) - for ebooks"
    echo "  - GitHub Pages (for HTML)"
    echo ""
    echo "Email to Kindle:"
    echo "  - Send .mobi or .epub to your @kindle.com email"
}

case "$1" in
    convert)
        cmd_convert "$2" "$3"
        ;;
    status)
        cmd_status "$2"
        ;;
    platforms)
        cmd_platforms
        ;;
    *)
        usage
        ;;
esac
