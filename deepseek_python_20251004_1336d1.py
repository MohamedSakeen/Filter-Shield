import json
import re
import os
from datetime import datetime

def convert_to_chromium_rules(input_file, output_file=None):
    """
    Convert a text file with domains to Chromium declarativeNetRequest rules JSON
    
    Args:
        input_file (str): Path to input text file with domains
        output_file (str): Path to output JSON file (optional)
    """
    
    # Set default output filename if not provided
    if output_file is None:
        base_name = os.path.splitext(input_file)[0]
        output_file = f"{base_name}_chromium_rules.json"
    
    # Read and process the input file
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"❌ Error: Input file '{input_file}' not found.")
        return False
    except Exception as e:
        print(f"❌ Error reading input file: {e}")
        return False
    
    rules = []
    processed_domains = []
    skipped_lines = []
    
    for line_num, line in enumerate(lines, 1):
        original_line = line.strip()
        
        # Skip empty lines and comments
        if not original_line:
            continue
        if original_line.startswith('#'):
            continue
        
        # Clean the line - remove "::" and any other non-domain characters
        clean_line = original_line
        
        # Remove common prefixes like "::", "0.0.0.0", "127.0.0.1"
        clean_line = re.sub(r'^(::|\d+\.\d+\.\d+\.\d+\s+|\|\|)', '', clean_line).strip()
        
        # Remove comments at end of line
        clean_line = re.sub(r'\s*#.*$', '', clean_line)
        
        # Extract domain using improved regex
        domain_match = re.search(
            r'^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$', 
            clean_line
        )
        
        if domain_match:
            domain = domain_match.group(0).lower()
            
            # Skip duplicates
            if domain in processed_domains:
                continue
                
            processed_domains.append(domain)
            
            # Create Chromium declarativeNetRequest rule
            rule = {
                "id": len(rules) + 1,
                "priority": 1,
                "action": { 
                    "type": "block" 
                },
                "condition": {
                    "urlFilter": f"||{domain}^",
                    "resourceTypes": [
                        "main_frame",
                        "sub_frame", 
                        "stylesheet",
                        "script",
                        "image",
                        "font",
                        "object",
                        "xmlhttprequest",
                        "ping",
                        "csp_report",
                        "media",
                        "websocket",
                        "webtransport",
                        "webbundle",
                        "other"
                    ]
                }
            }
            rules.append(rule)
        else:
            skipped_lines.append((line_num, original_line))
    
    # Create the final JSON structure for Chromium
    output_data = {
        "version": "1.0.0",
        "name": f"Blocklist generated from {os.path.basename(input_file)}",
        "description": f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "rules": rules
    }
    
    # Write to output file
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        
        # Print summary
        print(f"✅ Successfully converted {len(rules)} domains to Chromium rules")
        print(f"📁 Output file: {output_file}")
        
        if skipped_lines:
            print(f"⚠️  Skipped {len(skipped_lines)} invalid lines:")
            for line_num, line in skipped_lines[:5]:  # Show first 5 skipped lines
                print(f"   Line {line_num}: {line}")
            if len(skipped_lines) > 5:
                print(f"   ... and {len(skipped_lines) - 5} more")
        
        return True
        
    except Exception as e:
        print(f"❌ Error writing output file: {e}")
        return False

def create_simple_blocker_manifest(output_dir="chromium_extension"):
    """
    Create a complete Chromium extension structure for domain blocking
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Create manifest.json
    manifest = {
        "manifest_version": 3,
        "name": "Domain Blocker",
        "version": "1.0.0",
        "description": "Blocks domains from custom blocklist",
        "permissions": ["declarativeNetRequest"],
        "host_permissions": ["<all_urls>"],
        "background": {
            "service_worker": "background.js"
        },
        "action": {
            "default_popup": "popup.html",
            "default_title": "Domain Blocker"
        }
    }
    
    with open(os.path.join(output_dir, "manifest.json"), 'w') as f:
        json.dump(manifest, f, indent=2)
    
    # Create background.js
    background_js = """
chrome.runtime.onInstalled.addListener(() => {
    console.log('Domain Blocker extension installed');
});
"""
    with open(os.path.join(output_dir, "background.js"), 'w') as f:
        f.write(background_js)
    
    # Create popup.html
    popup_html = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { width: 200px; padding: 10px; }
        h3 { margin: 0 0 10px 0; }
        .status { color: green; font-weight: bold; }
    </style>
</head>
<body>
    <h3>Domain Blocker</h3>
    <div class="status">Active</div>
    <p>Blocking unwanted domains from your list.</p>
</body>
</html>
"""
    with open(os.path.join(output_dir, "popup.html"), 'w') as f:
        f.write(popup_html)
    
    print(f"✅ Chromium extension structure created in: {output_dir}")

def main():
    """Main function with command line interface"""
    print("🛡️  Text to Chromium Rules Converter")
    print("=" * 50)
    
    # Get input file
    input_file = input("Enter path to domains text file: ").strip()
    if not input_file:
        input_file = "domains.txt"
        print(f"Using default: {input_file}")
    
    if not os.path.exists(input_file):
        print(f"❌ Error: File '{input_file}' not found!")
        print("Please create a text file with domains (one per line)")
        print("Example format:")
        print("  example.com")
        print("  :: bad-site.net")
        print("  # This is a comment")
        return
    
    # Get output file
    output_file = input("Enter output JSON file (press Enter for auto-name): ").strip()
    if not output_file:
        output_file = None
    
    # Convert the file
    success = convert_to_chromium_rules(input_file, output_file)
    
    if success:
        # Ask about creating extension structure
        create_ext = input("\nCreate Chromium extension structure? (y/N): ").strip().lower()
        if create_ext == 'y':
            create_simple_blocker_manifest()
            print("\n📦 To use the extension:")
            print("1. Go to chrome://extensions/")
            print("2. Enable 'Developer mode'")
            print("3. Click 'Load unpacked' and select the 'chromium_extension' folder")
            print("4. Load your rules JSON file in the extension")

if __name__ == "__main__":
    main()