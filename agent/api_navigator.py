"""
API Navigator for python-api.md

This module parses the tskit Python API documentation and provides
table of contents-based navigation for code generation.
"""

import re
from typing import Dict, List, Tuple
from pathlib import Path


class APINavigator:
    """Navigate the tskit Python API documentation by sections."""

    def __init__(self, api_doc_path: str):
        """
        Initialize the API navigator.

        Args:
            api_doc_path: Path to the python-api.md file
        """
        self.api_doc_path = Path(api_doc_path)
        self.sections = {}
        self.toc = []
        self._parse_document()

    def _parse_document(self):
        """Parse the markdown document into sections."""
        with open(self.api_doc_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Split by headers (# through #####)
        # Pattern matches headers and captures level, title, and anchor
        header_pattern = r'^(#{1,5})\s+(.+?)(?:\[#\]\(#([^\)]+)\))?$'

        lines = content.split('\n')
        current_section = None
        current_content = []

        for i, line in enumerate(lines):
            match = re.match(header_pattern, line, re.MULTILINE)

            if match:
                # Save previous section
                if current_section:
                    self.sections[current_section['id']] = {
                        'title': current_section['title'],
                        'level': current_section['level'],
                        'content': '\n'.join(current_content).strip()
                    }
                    self.toc.append({
                        'id': current_section['id'],
                        'title': current_section['title'],
                        'level': current_section['level']
                    })

                # Start new section
                level = len(match.group(1))
                title = match.group(2).strip()
                anchor = match.group(3) if match.group(3) else self._title_to_id(title)

                current_section = {
                    'id': anchor,
                    'title': title,
                    'level': level
                }
                current_content = [line]
            else:
                if current_section:
                    current_content.append(line)

        # Save last section
        if current_section:
            self.sections[current_section['id']] = {
                'title': current_section['title'],
                'level': current_section['level'],
                'content': '\n'.join(current_content).strip()
            }
            self.toc.append({
                'id': current_section['id'],
                'title': current_section['title'],
                'level': current_section['level']
            })

    def _title_to_id(self, title: str) -> str:
        """Convert a title to an ID/anchor format."""
        # Remove markdown links and code formatting
        title = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', title)
        title = re.sub(r'`([^`]+)`', r'\1', title)

        # Convert to lowercase and replace spaces with hyphens
        section_id = title.lower()
        section_id = re.sub(r'[^\w\s-]', '', section_id)
        section_id = re.sub(r'[\s_]+', '-', section_id)
        section_id = re.sub(r'^-+|-+$', '', section_id)

        return section_id

    def get_toc(self, max_level: int = 4) -> str:
        """
        Get formatted table of contents.

        Args:
            max_level: Maximum heading level to include (1-5)

        Returns:
            Formatted table of contents as a string
        """
        toc_lines = ["# Table of Contents - tskit Python API\n"]

        for item in self.toc:
            if item['level'] <= max_level:
                indent = "  " * (item['level'] - 1)
                toc_lines.append(f"{indent}- [{item['title']}] (id: {item['id']})")

        return '\n'.join(toc_lines)

    def get_sections(self, section_ids: List[str]) -> str:
        """
        Get content for specified sections.

        Args:
            section_ids: List of section IDs to retrieve

        Returns:
            Concatenated content of all requested sections
        """
        content_parts = []

        for section_id in section_ids:
            if section_id in self.sections:
                section = self.sections[section_id]
                content_parts.append(f"\n{'#' * section['level']} {section['title']}\n")
                content_parts.append(section['content'])
                content_parts.append("\n")
            else:
                content_parts.append(f"\n[Section '{section_id}' not found]\n")

        return '\n'.join(content_parts)

    def search_sections(self, query: str, max_results: int = 5, search_content: bool = False) -> List[Dict]:
        """
        Search for sections matching a query.

        Args:
            query: Search query
            max_results: Maximum number of results to return
            search_content: If True, also search in section content (slower but more comprehensive)

        Returns:
            List of matching section metadata
        """
        query_lower = query.lower()
        matches = []

        for section_id, section_data in self.sections.items():
            # Search in title (always)
            if query_lower in section_data['title'].lower():
                matches.append({
                    'id': section_id,
                    'title': section_data['title'],
                    'level': section_data['level'],
                    'match_location': 'title'
                })
            # Optionally search in content
            elif search_content and query_lower in section_data['content'].lower():
                matches.append({
                    'id': section_id,
                    'title': section_data['title'],
                    'level': section_data['level'],
                    'match_location': 'content'
                })

        return matches[:max_results]

    def get_method_section(self, method_name: str) -> str:
        """
        Get documentation for a specific method.

        Args:
            method_name: Method name (e.g., "TreeSequence.diversity" or "diversity")

        Returns:
            Method documentation content or error message
        """
        # Try exact match first
        method_lower = method_name.lower()

        for section_id in self.sections:
            if method_lower in section_id.lower():
                return self.get_sections([section_id])

        return f"Method '{method_name}' not found in API documentation"


if __name__ == "__main__":
    # Test the navigator
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    api_doc_path = os.path.join(script_dir, "python-api.md")
    navigator = APINavigator(api_doc_path)

    print("=== TABLE OF CONTENTS (first 200 entries) ===")
    toc = navigator.get_toc(max_level=3)
    print('\n'.join(toc.split('\n')[:200]))

    print("\n\n=== SEARCH FOR 'tree' ===")
    results = navigator.search_sections("tree", max_results=100)
    for result in results:
        print(f"- {result['title']} (id: {result['id']})")

    print(f"\n\n=== TOTAL SECTIONS PARSED: {len(navigator.sections)} ===")
