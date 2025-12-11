export const defaultHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Salim Khan - Full Stack Developer Resume</title>
  <style>
    /* ===== ALL CSS SELECTOR TYPES TEST ===== */
    
    /* 1. TAG SELECTORS */
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f8f9fa;
      margin: 0;
      padding: 20px;
    }
    
    h1 { font-size: 2.5em; color: #1a1a1a; margin-bottom: 0.3em; }
    h2 { font-size: 1.8em; color: #2563eb; margin-bottom: 0.5em; }
    h3 { font-size: 1.4em; color: #334155; margin-bottom: 0.8em; border-left: 4px solid #3b82f6; padding-left: 12px; }
    h4 { font-size: 1.1em; color: #475569; margin-bottom: 0.4em; }
    p { line-height: 1.6; color: #475569; margin-bottom: 1em; }
    ul { list-style-type: disc; padding-left: 20px; }
    li { margin-bottom: 0.5em; color: #64748b; }
    section { margin-bottom: 2em; }
    header { border-bottom: 3px solid #2563eb; padding-bottom: 1.5em; margin-bottom: 2em; }
    
    /* 2. CLASS SELECTORS */
    .resume-container {
      max-width: 210mm;
      min-height: 297mm;
      background: white;
      margin: 0 auto;
      padding: 40px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    
    .contact-info { display: flex; flex-wrap: wrap; gap: 20px; color: #64748b; font-size: 0.9em; }
    .contact-item { display: flex; align-items: center; }
    .section-title { font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
    .skill-category { margin-bottom: 1.5em; }
    .skill-list { display: flex; flex-wrap: wrap; gap: 10px; padding: 0; list-style: none; }
    .skill-badge { background: #dbeafe; color: #1e40af; padding: 6px 12px; border-radius: 4px; font-size: 0.85em; font-weight: 500; }
    .job-title { font-weight: 600; color: #1e293b; }
    .company-name { color: #2563eb; font-weight: 500; }
    .date-range { color: #64748b; font-size: 0.9em; font-style: italic; }
    .highlight-box { background: #f1f5f9; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6; }
    
    /* 3. ID SELECTORS */
    #name { color: #0f172a; font-weight: 800; }
    #title { color: #3b82f6; font-weight: 600; font-size: 1.3em; }
    #summary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; }
    
    /* 4. DESCENDANT SELECTORS */
    .skills-grid .skill-category h4 { color: #1e40af; font-weight: 600; }
    .experience-list .job-item ul { margin-top: 10px; }
    .education-section .degree p { margin-bottom: 0.3em; }
    header .contact-info span { font-weight: 500; }
    
    /* 5. CHILD SELECTORS (Direct children only) */
    .skills-grid > div { background: #f8fafc; padding: 15px; border-radius: 8px; }
    .experience-list > div { margin-bottom: 25px; background: white; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; }
    .projects-grid > div { background: #fafafa; padding: 18px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.08); }
    
    /* 6. ADJACENT SIBLING SELECTORS (Immediately following) */
    h3 + p { color: #334155; font-weight: 500; }
    .job-title + .company-name { margin-top: 5px; display: block; }
    
    /* 7. GENERAL SIBLING SELECTORS (All following siblings) */
    h2 ~ section { margin-top: 1.5em; }
    .skill-badge ~ .skill-badge { margin-left: 0; }
    
    /* 8. ATTRIBUTE SELECTORS */
    [data-priority="high"] { border-left: 4px solid #dc2626; background: #fef2f2; }
    [data-priority="medium"] { border-left: 4px solid #f59e0b; background: #fffbeb; }
    [type="email"] { color: #2563eb; text-decoration: none; }
    [href^="http"] { color: #0891b2; }
    [class*="cert"] { font-size: 0.95em; }
    
    /* 9. PSEUDO-CLASSES */
    li:first-child { font-weight: 600; }
    li:last-child { margin-bottom: 0; }
    .skill-badge:nth-child(odd) { background: #e0e7ff; }
    .skill-badge:nth-child(even) { background: #dbeafe; }
    
    /* 10. COMPOUND SELECTORS (Element + Class/ID) */
    h3.section-heading { color: #1e293b; background: #f1f5f9; padding: 10px; border-radius: 4px; }
    div.highlight { background: #fffbeb; border: 2px solid #fbbf24; padding: 12px; }
    p#intro { font-size: 1.05em; color: #475569; font-style: italic; }
    
    /* 11. MULTIPLE CLASS SELECTORS */
    .skill-badge.featured { background: #3b82f6; color: white; font-weight: 700; }
    .job-item.current { border-left: 4px solid #10b981; }
    
    /* 12. COMPLEX COMBINATIONS */
    .experience-list > div:first-child h4 { color: #059669; }
    section:not(.education-section) h3 { margin-top: 0; }
    .skills-grid div:nth-child(2) .skill-badge { background: #fed7aa; color: #9a3412; }
  </style>
</head>
<body>
  <div class="resume-container">
    
    <!-- HEADER -->
    <header>
      <h1 id="name">Salim Khan</h1>
      <h2 id="title">Full Stack Developer</h2>
      <div class="contact-info">
        <span class="contact-item">📧 <span type="email">salim.khan.dev@email.com</span></span>
        <span class="contact-item">📱 +1 (555) 987-6543</span>
        <span class="contact-item">🔗 <a href="https://linkedin.com/in/salimkhan">LinkedIn</a></span>
        <span class="contact-item">💻 <a href="https://github.com/salimkhan">GitHub</a></span>
        <span class="contact-item">🌐 <a href="https://salimkhan.dev">Portfolio</a></span>
      </div>
    </header>

    <!-- PROFESSIONAL SUMMARY -->
    <section>
      <h3 class="section-heading">Professional Summary</h3>
      <div id="summary">
        <p id="intro">
          Innovative and results-driven Full Stack Developer with 6+ years of experience building high-performance 
          web applications. Expert in React, Node.js, TypeScript, and cloud-native architectures. Proven track 
          record of delivering scalable solutions that drive business growth and enhance user experience.
        </p>
      </div>
    </section>

    <!-- TECHNICAL SKILLS -->
    <section>
      <h3 class="section-heading">Technical Skills</h3>
      <div class="skills-grid">
        <div class="skill-category">
          <h4>Frontend Development</h4>
          <ul class="skill-list">
            <li class="skill-badge featured">React.js</li>
            <li class="skill-badge">Next.js</li>
            <li class="skill-badge">Vue.js</li>
            <li class="skill-badge">TypeScript</li>
            <li class="skill-badge">JavaScript (ES6+)</li>
            <li class="skill-badge">HTML5 & CSS3</li>
            <li class="skill-badge">Tailwind CSS</li>
            <li class="skill-badge">Redux</li>
          </ul>
        </div>
        
        <div class="skill-category">
          <h4>Backend Development</h4>
          <ul class="skill-list">
            <li class="skill-badge featured">Node.js</li>
            <li class="skill-badge">Express.js</li>
            <li class="skill-badge">Python</li>
            <li class="skill-badge">Django</li>
            <li class="skill-badge">FastAPI</li>
            <li class="skill-badge">GraphQL</li>
            <li class="skill-badge">REST APIs</li>
            <li class="skill-badge">Microservices</li>
          </ul>
        </div>
        
        <div class="skill-category">
          <h4>Database & Cloud</h4>
          <ul class="skill-list">
            <li class="skill-badge">PostgreSQL</li>
            <li class="skill-badge">MongoDB</li>
            <li class="skill-badge">Redis</li>
            <li class="skill-badge">AWS</li>
            <li class="skill-badge">Google Cloud</li>
            <li class="skill-badge">Docker</li>
            <li class="skill-badge">Kubernetes</li>
            <li class="skill-badge">CI/CD</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- PROFESSIONAL EXPERIENCE -->
    <section>
      <h3 class="section-heading">Professional Experience</h3>
      <div class="experience-list">
        
        <div class="job-item current" data-priority="high">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <h4 class="job-title">Senior Full Stack Developer</h4>
              <p class="company-name">Tech Innovations Inc. • San Francisco, CA</p>
            </div>
            <span class="date-range">Jan 2021 - Present</span>
          </div>
          <ul>
            <li>Led development of microservices architecture serving 2M+ active users with 99.99% uptime</li>
            <li>Reduced API response time by 45% through database optimization and caching strategies</li>
            <li>Mentored team of 6 junior developers and conducted code reviews</li>
            <li>Implemented automated testing pipeline, increasing code coverage from 60% to 95%</li>
            <li>Architected real-time notification system using WebSockets and Redis</li>
          </ul>
        </div>

        <div class="job-item" data-priority="medium">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <h4 class="job-title">Full Stack Developer</h4>
              <p class="company-name">Digital Solutions Ltd. • Remote</p>
            </div>
            <span class="date-range">Mar 2019 - Dec 2020</span>
          </div>
          <ul>
            <li>Built and deployed 12+ responsive web applications using React and Node.js</li>
            <li>Integrated payment processing (Stripe, PayPal) for e-commerce platforms</li>
            <li>Designed and implemented RESTful APIs consumed by mobile applications</li>
            <li>Collaborated with UX/UI team to implement pixel-perfect designs</li>
          </ul>
        </div>

        <div class="job-item">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <h4 class="job-title">Junior Web Developer</h4>
              <p class="company-name">StartUp Hub • New York, NY</p>
            </div>
            <span class="date-range">Jun 2018 - Feb 2019</span>
          </div>
          <ul>
            <li>Developed front-end features using Vue.js and modern JavaScript</li>
            <li>Maintained and debugged legacy codebase, improving performance by 30%</li>
            <li>Participated in agile sprints and daily standups</li>
          </ul>
        </div>

      </div>
    </section>

    <!-- EDUCATION -->
    <section class="education-section">
      <h3 class="section-heading">Education</h3>
      <div class="highlight-box">
        <div class="degree">
          <h4>Bachelor of Science in Computer Science</h4>
          <p class="company-name">University of California, Berkeley</p>
          <p class="date-range">2014 - 2018 • GPA: 3.9/4.0 • Summa Cum Laude</p>
          <p><strong>Relevant Coursework:</strong> Data Structures, Algorithms, Database Systems, Web Development, Cloud Computing</p>
        </div>
      </div>
    </section>

    <!-- CERTIFICATIONS -->
    <section>
      <h3 class="section-heading">Certifications</h3>
      <ul class="cert-list">
        <li class="cert-item">AWS Certified Solutions Architect - Professional (2023)</li>
        <li class="cert-item">Google Cloud Professional Developer (2022)</li>
        <li class="cert-item">MongoDB Certified Developer Associate (2021)</li>
        <li class="cert-item">Certified Kubernetes Administrator (CKA) (2022)</li>
      </ul>
    </section>

    <!-- NOTABLE PROJECTS -->
    <section>
      <h3 class="section-heading">Notable Projects</h3>
      <div class="projects-grid">
        
        <div class="highlight" data-priority="high">
          <h4>🚀 E-Commerce Platform (SaaS)</h4>
          <p>
            Multi-tenant e-commerce platform built with Next.js, GraphQL, and PostgreSQL. Supports 50K+ 
            daily transactions, automated inventory management, and AI-powered product recommendations.
          </p>
          <ul class="skill-list">
            <li class="skill-badge">Next.js</li>
            <li class="skill-badge">GraphQL</li>
            <li class="skill-badge">PostgreSQL</li>
            <li class="skill-badge">Stripe</li>
            <li class="skill-badge">AWS</li>
          </ul>
        </div>

        <div data-priority="medium">
          <h4>📊 Real-Time Analytics Dashboard</h4>
          <p>
            Enterprise analytics platform with live data visualization, custom reports, and WebSocket-based 
            real-time updates. Processes 1M+ events daily.
          </p>
          <ul class="skill-list">
            <li class="skill-badge">React</li>
            <li class="skill-badge">D3.js</li>
            <li class="skill-badge">Node.js</li>
            <li class="skill-badge">Redis</li>
            <li class="skill-badge">MongoDB</li>
          </ul>
        </div>

        <div>
          <h4>🤖 AI Content Generator</h4>
          <p>
            AI-powered content generation tool using GPT-4 API. Features include template management, 
            bulk generation, and SEO optimization.
          </p>
          <ul class="skill-list">
            <li class="skill-badge">Python</li>
            <li class="skill-badge">FastAPI</li>
            <li class="skill-badge">OpenAI API</li>
            <li class="skill-badge">Vue.js</li>
          </ul>
        </div>

      </div>
    </section>

  </div>
</body>
</html>
`;




