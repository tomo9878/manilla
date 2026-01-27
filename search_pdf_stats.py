
import pypdf
import re

def search_pdf(pdf_path, terms):
    reader = pypdf.PdfReader(pdf_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    
    for term in terms:
        print(f"--- Searching for '{term}' ---")
        matches = re.finditer(term, text, re.IGNORECASE)
        for i, match in enumerate(matches):
            if i > 5: break # Limit 5 matches
            start = max(0, match.start() - 200)
            end = min(len(text), match.end() + 200)
            snippet = text[start:end]
            try:
                print(f"...{snippet}...")
            except UnicodeEncodeError:
                print(f"...{snippet.encode('utf-8', 'replace').decode('utf-8')}...")
            print("-" * 20)

if __name__ == "__main__":
    search_pdf("Manila_Rules (1).pdf", ["Attack Factor", "Movement Factor", "American Units", "Attack Value", "Movement Allowance"])
