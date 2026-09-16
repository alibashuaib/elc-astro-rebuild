import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compiledFile = path.join(__dirname, '../src/lib/compiled-courses.json');
const distDir = path.join(__dirname, '../dist');

// Read compiled courses
const coursesData = JSON.parse(fs.readFileSync(compiledFile, 'utf-8'));

// Simple HTML template for course pages
function generateCourseHTML(courseId, data, locale) {
  const isArabic = locale === 'ar';
  const baseUrl = `/${locale}`;

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${isArabic ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${data.title} — ${isArabic ? 'معهد صرح المعرفة' : 'ELC'}</title>
  <meta name="description" content="${data.summary}">
  <link rel="canonical" href="https://elc.com.sa${baseUrl}/courses/${courseId.split('/')[1]}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 2.5rem; margin: 1rem 0; }
    .summary { font-size: 1.1rem; color: #666; margin: 1rem 0; }
    .nav { margin: 2rem 0; padding: 1rem; background: #f5f5f5; border-radius: 8px; }
    .nav a { color: #0066cc; text-decoration: none; margin-right: 1rem; }
    .nav a:hover { text-decoration: underline; }
    .content { margin: 2rem 0; padding: 1rem; background: #fafafa; border-radius: 8px; }
    .content h2 { margin: 1.5rem 0 1rem; color: #222; }
    .content ul, .content ol { margin-left: 2rem; margin-bottom: 1rem; }
    .content li { margin: 0.5rem 0; }
    .footer { margin-top: 3rem; padding-top: 2rem; border-top: 1px solid #ddd; text-align: center; color: #999; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="${baseUrl}/">← ${isArabic ? 'الرئيسية' : 'Home'}</a>
      <a href="${baseUrl}/courses">${isArabic ? 'جميع الدورات' : 'All Courses'}</a>
    </div>

    <article>
      <h1>${data.title}</h1>
      <p class="summary">${data.summary}</p>

      <div class="content">
        ${data.contentHtml || '<p>Course details coming soon.</p>'}
      </div>

      ${data.faqs && data.faqs.length > 0 ? `
      <section>
        <h2>${isArabic ? 'الأسئلة الشائعة' : 'FAQs'}</h2>
        ${data.faqs.map(faq => `
          <div style="margin: 1.5rem 0; padding: 1rem; background: #f9f9f9; border-left: 4px solid #0066cc;">
            <strong>${faq.question}</strong>
            <p style="margin-top: 0.5rem; color: #666;">${faq.answer}</p>
          </div>
        `).join('')}
      </section>
      ` : ''}
    </article>

    <div class="footer">
      <p>${isArabic ? '© معهد صرح المعرفة' : '© English Language Center'} ${new Date().getFullYear()}</p>
      <p><a href="${baseUrl}/courses/${courseId.split('/')[1]}">${isArabic ? 'تسجيل' : 'Enroll'}</a></p>
    </div>
  </div>
</body>
</html>`;
}

function generateStaticCourses() {
  let count = 0;

  for (const [courseId, data] of Object.entries(coursesData)) {
    const [lang, slug] = courseId.split('/');
    const courseDir = path.join(distDir, lang, 'courses', slug);

    // Create directories
    fs.mkdirSync(courseDir, { recursive: true });

    // Generate HTML
    const html = generateCourseHTML(slug, data, lang);
    const indexPath = path.join(courseDir, 'index.html');

    fs.writeFileSync(indexPath, html);
    console.log(`✓ Generated ${lang}/courses/${slug}/index.html`);
    count++;
  }

  console.log(`\n✓ Total course pages generated: ${count}`);
}

generateStaticCourses();
