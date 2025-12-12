export const defaultHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Max Johnson - UX Designer Resume</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 min-h-screen flex items-center justify-center p-4 sm:p-8">
    <div class="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        <!-- Left Sidebar -->
        <div class="bg-slate-800 text-white w-full md:w-2/5 p-8">
            <!-- Profile Photo -->
            <div class="flex justify-center mb-8">
                <div class="w-36 h-36 rounded-full overflow-hidden border-4 border-slate-600">
                    <img src="/placeholder.svg?height=144&width=144" alt="Profile Photo" class="w-full h-full object-cover">
                </div>
            </div>

            <!-- Contact Section -->
            <div class="mb-8">
                <h2 class="text-2xl font-bold mb-4 pb-2 border-b-2 border-slate-600">Contact</h2>
                <div class="space-y-4">
                    <div>
                        <h3 class="text-sm font-semibold text-slate-400 mb-1">Address</h3>
                        <p class="text-sm">New York, USA</p>
                    </div>
                    <div>
                        <h3 class="text-sm font-semibold text-slate-400 mb-1">Phone</h3>
                        <p class="text-sm">+1 2345 6789</p>
                    </div>
                    <div>
                        <h3 class="text-sm font-semibold text-slate-400 mb-1">Email</h3>
                        <p class="text-sm">max.johnson@email.com</p>
                    </div>
                </div>
            </div>

            <!-- Skills Section -->
            <div class="mb-8">
                <h2 class="text-2xl font-bold mb-4 pb-2 border-b-2 border-slate-600">Skills</h2>
                <ul class="space-y-2">
                    <li class="flex items-center text-sm">
                        <span class="mr-2">•</span> Figma
                    </li>
                    <li class="flex items-center text-sm">
                        <span class="mr-2">•</span> Adobe XD
                    </li>
                    <li class="flex items-center text-sm">
                        <span class="mr-2">•</span> Sketch
                    </li>
                    <li class="flex items-center text-sm">
                        <span class="mr-2">•</span> InVision
                    </li>
                    <li class="flex items-center text-sm">
                        <span class="mr-2">•</span> Photoshop
                    </li>
                </ul>
            </div>

            <!-- Languages Section -->
            <div class="mb-8">
                <h2 class="text-2xl font-bold mb-4 pb-2 border-b-2 border-slate-600">Languages</h2>
                <ul class="space-y-2">
                    <li class="flex items-center text-sm">
                        <span class="mr-2">•</span> English
                    </li>
                    <li class="flex items-center text-sm">
                        <span class="mr-2">•</span> French
                    </li>
                    <li class="flex items-center text-sm">
                        <span class="mr-2">•</span> Russian
                    </li>
                </ul>
            </div>

            <!-- Hobbies Section -->
            <div>
                <h2 class="text-2xl font-bold mb-4 pb-2 border-b-2 border-slate-600">Hobbies</h2>
                <ul class="space-y-2">
                    <li class="flex items-center text-sm">
                        <span class="mr-2">•</span> Photography
                    </li>
                    <li class="flex items-center text-sm">
                        <span class="mr-2">•</span> Football
                    </li>
                    <li class="flex items-center text-sm">
                        <span class="mr-2">•</span> Cooking
                    </li>
                </ul>
            </div>
        </div>

        <!-- Right Main Content -->
        <div class="w-full md:w-3/5 p-8 md:p-12 text-slate-800">
            <!-- Header -->
            <div class="mb-8">
                <h1 class="text-4xl font-bold mb-2">MAX JOHNSON</h1>
                <p class="text-lg text-slate-600">UX Designer</p>
            </div>

            <!-- Profile Section -->
            <div class="mb-8">
                <h2 class="text-2xl font-bold mb-3 pb-2 border-b-2 border-slate-300">Profile</h2>
                <p class="text-sm leading-relaxed text-slate-700">
                    Experienced UX Designer specializing in user research, interaction design, and prototyping. Committed to delivering intuitive and visually compelling digital experiences that captivate users. A problem-solver who combines creativity with data-driven insights to drive innovation.
                </p>
            </div>

            <!-- Work Experience Section -->
            <div class="mb-8">
                <h2 class="text-2xl font-bold mb-4 pb-2 border-b-2 border-slate-300">Work Experience</h2>

                <div class="mb-6">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h3 class="font-bold text-base">Senior UX Designer</h3>
                            <p class="text-sm text-slate-600">Digital Solutions – New York</p>
                        </div>
                        <span class="text-sm text-slate-600 whitespace-nowrap">Jan 2020 – Dec 2022</span>
                    </div>
                    <ul class="ml-5 space-y-2">
                        <li class="text-sm text-slate-700 leading-relaxed">
                            Led UX team for mobile banking app, boosting user engagement by 50% in six months.
                        </li>
                        <li class="text-sm text-slate-700 leading-relaxed">
                            Conducted in-depth user research, reducing e-commerce cart abandonment by 25% through redesign.
                        </li>
                    </ul>
                </div>

                <div>
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h3 class="font-bold text-base">UX Designer</h3>
                            <p class="text-sm text-slate-600">Creative Agency – Texas</p>
                        </div>
                        <span class="text-sm text-slate-600 whitespace-nowrap">Jan 2018 – Dec 2019</span>
                    </div>
                    <ul class="ml-5 space-y-2">
                        <li class="text-sm text-slate-700 leading-relaxed">
                            Collaborated with diverse clients to align designs with business objectives, achieving a 15% boost in healthcare app user satisfaction.
                        </li>
                        <li class="text-sm text-slate-700 leading-relaxed">
                            Conducted impactful user tests on a financial site, pinpointing pain points and driving a 20% surge in conversion rates.
                        </li>
                    </ul>
                </div>
            </div>

            <!-- Education Section -->
            <div>
                <h2 class="text-2xl font-bold mb-4 pb-2 border-b-2 border-slate-300">Education</h2>

                <div class="mb-4">
                    <div class="flex justify-between items-start mb-1">
                        <div>
                            <h3 class="font-bold text-base">Master of Science in HCI</h3>
                            <p class="text-sm text-slate-600">New York University – New York</p>
                        </div>
                        <span class="text-sm text-slate-600 whitespace-nowrap">Jan 2016 – Dec 2018</span>
                    </div>
                </div>

                <div>
                    <div class="flex justify-between items-start mb-1">
                        <div>
                            <h3 class="font-bold text-base">Bachelor of Science in UX Design</h3>
                            <p class="text-sm text-slate-600">University of Washington – Washington</p>
                        </div>
                        <span class="text-sm text-slate-600 whitespace-nowrap">Jan 2011 – Dec 2015</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>


`;




