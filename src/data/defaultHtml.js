export const defaultHtml = `
<style>
  /* 1. COMPREHENSIVE GLOBAL RESET (Matches working file for consistent metrics) */
  * {
      box-sizing: border-box !important;
      max-width: 100% !important;
      word-break: normal;
      overflow-wrap: normal;
      word-wrap: normal;
      hyphens: none !important;
      white-space: normal !important;
      scrollbar-width: none !important; /* Firefox */
      min-width: 0 !important;
      line-height: normal !important;
  }

  /* Hide scrollbars for Chrome, Safari and Opera */
  *::-webkit-scrollbar {
      display: none !important;
  }

  table {
      width: 100% !important;
      table-layout: fixed !important; 
  }

  td, th {
      word-break: normal !important;
      white-space: normal !important;
  }

  .visual-page {
      overflow: hidden !important; 
  }

  /* Force symbols and characters to render even if clipped */
  * {
    -webkit-print-color-adjust: exact !important;
    color-adjust: exact !important;
    line-height: normal !important;
    break-inside: auto !important;
    page-break-inside: auto !important;
    orphans: 1 !important;
    widows: 1 !important;
  }

  #visual-page-id {
    width: 210mm !important;
    max-width: 210mm !important;
    min-width: 210mm !important;
    margin: 0 auto !important;
    background: white !important;
    padding: 0px !important;
    position: relative !important;
    display: flow-root !important;
    overflow-anchor: none;
    overflow: hidden !important;
  }

  /* Standard font stack for metrics consistency, but excluding Font Awesome icons */
  body, #visual-page-id, #visual-page-id *:not(.fas):not(.fab):not(.fa):not(.far) {
    font-family: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
  }

  /* 7. SECTIONAL STABILITY */
  section, header {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    position: relative !important;
  }
</style>

<div data-gjs-highlightable="true" id="visual-page-id" data-gjs-type="visual-page">
  <div style="padding-left:6px; padding-right:6px;">
    <div data-gjs-highlightable="true" id="ieq3" data-gjs-type="default" draggable="true" class="">
      <div data-gjs-highlightable="true" id="imef" data-gjs-type="default" draggable="true" class="resume-container-fixed font-sans text-gray-800 leading-normal p-6">
        <!-- Header: Name, Title, Contact Info -->
        <header data-gjs-highlightable="true" id="i7bj" data-gjs-type="default" draggable="true" class="pb-8 mb-4 border-b border-gray-300">
          <h1 data-gjs-highlightable="true" id="iax8" data-gjs-type="text" draggable="true" class="text-5xl font-extrabold text-gray-900 mb-2 tracking-tight">Salim Khan</h1>
          <p data-gjs-highlightable="true" id="ianwo" data-gjs-type="text" draggable="true" class="text-xl font-semibold text-indigo-700 mb-4">Senior Full-Stack Developer</p>
          <div data-gjs-highlightable="true" id="i1rfw" data-gjs-type="default" draggable="true" class="flex flex-wrap text-lg text-gray-600">
            <span data-gjs-highlightable="true" id="iqg7u" data-gjs-type="text" draggable="true" class="mr-6 flex items-center"><i id="i603j" data-gjs-type="default" draggable="true" class="fas fa-map-marker-alt text-indigo-500 mr-2"></i> San Francisco Bay Area</span>
            <span data-gjs-highlightable="true" id="imrfv" data-gjs-type="text" draggable="true" class="mr-6 flex items-center"><i id="ib4gq" data-gjs-type="default" draggable="true" class="fas fa-envelope text-indigo-500 mr-2"></i> salim.khan.dev@gmail.com</span>
            <span data-gjs-highlightable="true" id="ikixi" data-gjs-type="text" draggable="true" class="mr-6 flex items-center"><i id="i20j1" data-gjs-type="default" draggable="true" class="fas fa-phone text-indigo-500 mr-2"></i> +1 (555) 123-4567</span>
            <span data-gjs-highlightable="true" id="int34" data-gjs-type="text" draggable="true" class="mr-6 flex items-center"><i id="iq2yl" data-gjs-type="default" draggable="true" class="fab fa-linkedin text-indigo-500 mr-2"></i> <a id="ivkea" data-gjs-type="link" draggable="true" href="https://linkedin.com/in/salimkhandev" class="text-blue-600 hover:underline">linkedin.com/in/salimkhandev</a></span>
            <span data-gjs-highlightable="true" id="ie8mb" data-gjs-type="text" draggable="true" class="mr-6 flex items-center"><i id="i4rm9" data-gjs-type="default" draggable="true" class="fab fa-github text-indigo-500 mr-2"></i> <a id="idcdc" data-gjs-type="link" draggable="true" href="https://github.com/Salim-Khan" class="text-blue-600 hover:underline">github.com/Salim-Khan</a></span>
            <span data-gjs-highlightable="true" id="isu3h" data-gjs-type="text" draggable="true" class="flex items-center"><i id="ijc97" data-gjs-type="default" draggable="true" class="fas fa-globe text-indigo-500 mr-2"></i> <a id="it5po" data-gjs-type="link" draggable="true" href="https://salimkhan.dev" class="text-blue-600 hover:underline">salimkhan.dev</a></span>
          </div>
        </header>

        <!-- Professional Summary -->
        <section data-gjs-highlightable="true" id="i2usl" data-gjs-type="default" draggable="true" class="pb-8">
          <h2 data-gjs-highlightable="true" id="ibmkp" data-gjs-type="text" draggable="true" class="text-3xl font-bold text-gray-900 mb-4 border-b-2 border-indigo-500 pb-2"><i id="idr0u" data-gjs-type="default" draggable="true" class="fas fa-star text-indigo-500 mr-3"></i>Professional Summary</h2>
          <p data-gjs-highlightable="true" id="iuge9" data-gjs-type="text" draggable="true" class="text-lg leading-relaxed text-gray-700">
            Elite Full-Stack Developer with <span id="i2lj9" data-gjs-type="text" draggable="true" class="font-semibold">8+ years</span> architecting high-performance, scalable applications used by millions. Expert in modern JavaScript/TypeScript ecosystems (<span id="ixt5e" data-gjs-type="text" draggable="true" class="font-semibold">React, Next.js, Node.js, NestJS</span>), cloud-native architectures (<span id="i8ojg" data-gjs-type="text" draggable="true" class="font-semibold">AWS, Vercel, Docker, Kubernetes</span>), databases (<span id="i9kik" data-gjs-type="text" draggable="true" class="font-semibold">PostgreSQL, MongoDB, Redis, DynamoDB</span>), and DevOps/CI/CD. Passionate about clean code, performance optimization, AI integration, PWAs, serverless, and turning complex business problems into elegant user experiences. Delivered <span id="izsq3" data-gjs-type="text" draggable="true" class="font-semibold">20+ production-grade products end-to-end</span>.
          </p>
        </section>

        <!-- Core Technical Skills -->
        <section data-gjs-highlightable="true" id="igjsf" data-gjs-type="default" draggable="true" class="pb-8">
          <h2 data-gjs-highlightable="true" id="ib7jz" data-gjs-type="text" draggable="true" class="text-3xl font-bold text-gray-900 mb-4 border-b-2 border-indigo-500 pb-2"><i id="ii8rp" data-gjs-type="default" draggable="true" class="fas fa-code text-indigo-500 mr-3"></i>Core Technical Skills</h2>
          <div data-gjs-highlightable="true" id="inbnz" data-gjs-type="default" draggable="true" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 text-lg text-gray-700">
            <div data-gjs-highlightable="true" id="i4v02" data-gjs-type="default" draggable="true">
              <h3 data-gjs-highlightable="true" id="iklh9" data-gjs-type="text" draggable="true" class="font-bold text-xl text-gray-800 mb-1">Frontend <i id="ioquj" data-gjs-type="default" draggable="true" class="fas fa-laptop-code text-indigo-500 ml-2"></i></h3>
              <ul data-gjs-highlightable="true" id="ibgao" data-gjs-type="default" draggable="true" class="list-disc list-inside ml-4">
                <li data-gjs-highlightable="true" id="iaptp" data-gjs-type="text" draggable="true">React 18+, Next.js 14+, TypeScript</li>
                <li data-gjs-highlightable="true" id="id29l" data-gjs-type="text" draggable="true">Tailwind CSS, Shadcn/UI, Radix UI</li>
                <li data-gjs-highlightable="true" id="izj9g" data-gjs-type="text" draggable="true">Framer Motion, Redux Toolkit / Zustand</li>
                <li data-gjs-highlightable="true" id="irtwk" data-gjs-type="text" draggable="true">TanStack Query, Vite</li>
              </ul>
            </div>
            <div data-gjs-highlightable="true" id="igh6w" data-gjs-type="default" draggable="true" class="">
              <h3 data-gjs-highlightable="true" id="iel9u" data-gjs-type="text" draggable="true" class="font-bold text-xl text-gray-800 mb-1">Backend <i id="iujcp" data-gjs-type="default" draggable="true" class="fas fa-server text-indigo-500 ml-2"></i></h3>
              <ul data-gjs-highlightable="true" id="i1uhc" data-gjs-type="default" draggable="true" class="list-disc list-inside ml-4">
                <li data-gjs-highlightable="true" id="in39z" data-gjs-type="text" draggable="true" class="">Node.js, Express, NestJS, Fastify</li>
                <li data-gjs-highlightable="true" id="icogi" data-gjs-type="text" draggable="true" class="">GraphQL (Apollo), tRPC, REST APIs</li>
                <li data-gjs-highlightable="true" id="icb1g" data-gjs-type="text" draggable="true" class="">WebSockets (Socket.io)</li>
              </ul>
            </div>
            <div data-gjs-highlightable="true" id="iq7gi" data-gjs-type="default" draggable="true" class="">
              <h3 data-gjs-highlightable="true" id="itift" data-gjs-type="text" draggable="true" class="font-bold text-xl text-gray-800 mb-1">Databases &amp; Storage <i id="iref1" data-gjs-type="default" draggable="true" class="fas fa-database text-indigo-500 ml-2"></i></h3>
              <ul data-gjs-highlightable="true" id="ihs6w" data-gjs-type="default" draggable="true" class="list-disc list-inside ml-4">
                <li data-gjs-highlightable="true" id="ihxoc" data-gjs-type="text" draggable="true" class="">PostgreSQL, Prisma, MongoDB, Mongoose</li>
                <li data-gjs-highlightable="true" id="ifd3i" data-gjs-type="text" draggable="true" class="">Redis, Supabase, Firebase, DynamoDB</li>
              </ul>
            </div>
          </div>
        </section>

        <!-- Professional Experience -->
        <section data-gjs-highlightable="true" id="i4say6" data-gjs-type="default" draggable="true" class="pb-8">
          <h2 data-gjs-highlightable="true" id="iuy70j" data-gjs-type="text" draggable="true" class="text-3xl font-bold text-gray-900 mb-4 border-b-2 border-indigo-500 pb-2"><i id="ivh8l1" data-gjs-type="default" draggable="true" class="fas fa-briefcase text-indigo-500 mr-3"></i>Professional Experience</h2>
          <div data-gjs-highlightable="true" id="iow9u7" data-gjs-type="default" draggable="true" class="mb-6">
            <h3 data-gjs-highlightable="true" id="iqj36g" data-gjs-type="text" draggable="true" class="text-xl font-bold text-gray-800">Senior Full-Stack Engineer, <span id="i00c2s" data-gjs-type="text" draggable="true" class="text-indigo-700">TechNova Solutions</span> (Remote)</h3>
            <p data-gjs-highlightable="true" id="ir7qqj" data-gjs-type="text" draggable="true" class="text-md text-gray-600 mb-2">2023–Present</p>
            <ul data-gjs-highlightable="true" id="i2w8kn" data-gjs-type="default" draggable="true" class="list-disc list-inside ml-4 text-lg text-gray-700">
              <li data-gjs-highlightable="true" id="i5f3ec" data-gjs-type="text" draggable="true" class="">Led end-to-end development of SaaS platform serving <span id="i4sccj" data-gjs-type="text" draggable="true" class="font-semibold">500K+ monthly users</span>, reducing load time <span id="i9qn3i" data-gjs-type="text" draggable="true" class="font-semibold">65%</span> via Next.js App Router + server components.</li>
              <li data-gjs-highlightable="true" id="ivy8c6" data-gjs-type="text" draggable="true" class="">Architected microservices backend with NestJS + PostgreSQL + Redis caching, handling <span id="i45bh5" data-gjs-type="text" draggable="true" class="font-semibold">10M+ requests/day</span> with <span id="ivpjez" data-gjs-type="text" draggable="true" class="font-semibold">99.99% uptime</span>.</li>
            </ul>
          </div>
          <div data-gjs-highlightable="true" id="ih4p4a" data-gjs-type="default" draggable="true" class="mb-6">
            <h3 data-gjs-highlightable="true" id="ifqida" data-gjs-type="text" draggable="true" class="text-xl font-bold text-gray-800">Full-Stack Developer, <span id="iy65ig" data-gjs-type="text" draggable="true" class="text-indigo-700">ScaleUp Ventures</span> (Berlin)</h3>
            <p data-gjs-highlightable="true" id="iaxd8j" data-gjs-type="text" draggable="true" class="text-md text-gray-600 mb-2">2020–2023</p>
            <ul data-gjs-highlightable="true" id="izoa61" data-gjs-type="default" draggable="true" class="list-disc list-inside ml-4 text-lg text-gray-700">
              <li data-gjs-highlightable="true" id="is0ifq" data-gjs-type="text" draggable="true" class="">Built responsive PWA e-commerce solution (React + Next.js + Stripe + Supabase) generating <span id="id19gi" data-gjs-type="text" draggable="true" class="font-semibold">$4.2M revenue</span> in first year.</li>
              <li data-gjs-highlightable="true" id="im1d03" data-gjs-type="text" draggable="true" class="">Designed &amp; deployed Kubernetes cluster on AWS, cutting infrastructure costs <span id="i3f905" data-gjs-type="text" draggable="true" class="font-semibold">38%</span>.</li>
            </ul>
          </div>
        </section>

        <!-- Education -->
        <section data-gjs-highlightable="true" id="i7ysyl" data-gjs-type="default" draggable="true" class="pb-8">
          <h2 data-gjs-highlightable="true" id="iqqiod" data-gjs-type="text" draggable="true" class="text-3xl font-bold text-gray-900 mb-4 border-b-2 border-indigo-500 pb-2"><i id="ibzfs4" data-gjs-type="default" draggable="true" class="fas fa-graduation-cap text-indigo-500 mr-3"></i>Education</h2>
          <div data-gjs-highlightable="true" id="i7mw0u" data-gjs-type="default" draggable="true" class="text-lg text-gray-700">
            <h3 data-gjs-highlightable="true" id="ic18kh" data-gjs-type="text" draggable="true" class="font-bold text-xl text-gray-800">Bachelor of Science in Computer Science</h3>
            <p data-gjs-highlightable="true" id="iep5b1" data-gjs-type="text" draggable="true" class="text-indigo-700">University of Toronto | 2018</p>
          </div>
        </section>
      </div>
    </div>
  </div>
</div>
`;