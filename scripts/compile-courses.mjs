import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coursesDir = path.join(__dirname, '../src/content/courses');
const outputFile = path.join(__dirname, '../src/lib/compiled-courses.json');

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const frontmatter = {};
  const yamlContent = match[1];
  const body = match[2];

  // Parse YAML frontmatter
  const lines = yamlContent.split('\n');
  let currentKey = null;
  let currentArray = null;

  for (const line of lines) {
    if (line.startsWith('faqs:')) {
      currentKey = 'faqs';
      currentArray = [];
      frontmatter.faqs = currentArray;
    } else if (line.match(/^  - question:/)) {
      const question = line.replace(/^  - question:\s*/, '').trim();
      currentArray.push({ question, answer: '' });
    } else if (line.match(/^    answer:/)) {
      const answer = line.replace(/^    answer:\s*/, '').trim();
      if (currentArray.length > 0) {
        currentArray[currentArray.length - 1].answer = answer;
      }
    } else if (line.match(/^[a-z]+:/)) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();
      frontmatter[key.trim()] = value || null;
    }
  }

  return { frontmatter, body };
}

async function compileCourses() {
  const courses = {};
  const courseFiles = fs.readdirSync(coursesDir, { recursive: true })
    .filter(f => f.endsWith('.md'));

  for (const file of courseFiles) {
    const filePath = path.join(coursesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);

    const html = await marked.parse(body);
    const id = file.replace('.md', '').replace(/\\/g, '/');

    courses[id] = {
      ...frontmatter,
      contentHtml: html
    };

    console.log(`✓ Compiled ${id}`);
  }

  fs.writeFileSync(outputFile, JSON.stringify(courses, null, 2));
  console.log(`\n✓ Written to ${outputFile}`);
  console.log(`✓ Total courses: ${Object.keys(courses).length}`);
}

compileCourses().catch(err => {
  console.error('Error compiling courses:', err);
  process.exit(1);
});
