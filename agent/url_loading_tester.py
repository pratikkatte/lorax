import requests
from pathlib import Path
from bs4 import BeautifulSoup
import markdownify
import time

def scrape_tskit_docs():
    base_url = "https://tskit.dev/tskit/docs/stable/"
    
    # Key documentation pages
    pages = [
        "introduction.html",
        "installation.html",
        "python-api.html",
        "data-model.html",
        "trees.html",
        "tables.html",
        "stats.html",
        "metadata.html",
        "terminology.html",
        # Add more pages as needed
    ]
    
    output_dir = Path("tskit_docs_markdown")
    output_dir.mkdir(exist_ok=True)
    
    for page in pages:
        url = base_url + page
        print(f"Scraping {page}...")
        
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract main content
            main = (
                soup.find('main') or 
                soup.find('div', {'role': 'main'}) or
                soup.find('article')
            )
            
            if main:
                # Convert HTML to markdown
                md_content = markdownify.markdownify(
                    str(main),
                    heading_style="ATX",
                    bullets="-",
                    code_language="python"
                )
                
                # Extract metadata
                title = soup.find('title')
                title_text = title.get_text() if title else page
                
                # Save to file
                output_file = output_dir / page.replace('.html', '.md')
                with open(output_file, 'w', encoding='utf-8') as f:
                    f.write(f"---\n")
                    f.write(f"source: {url}\n")
                    f.write(f"title: {title_text}\n")
                    f.write(f"---\n\n")
                    f.write(md_content)
                
                print(f"  ✓ Saved to {output_file}")
            else:
                print(f"  ✗ Could not find main content")
        
        except Exception as e:
            print(f"  ✗ Error: {e}")
        
        time.sleep(0.5)  # Be polite to the server
    
    print(f"\nDone! Scraped {len(pages)} pages to {output_dir}/")

if __name__ == "__main__":
    # Install dependencies first:
    # pip install requests beautifulsoup4 markdownify
    scrape_tskit_docs()