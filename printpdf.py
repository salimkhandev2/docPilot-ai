from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration
import os
import requests
from datetime import datetime

def generate_complex_pdf():
    # Use a timestamp for a unique filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_filename = f"report_tailwind_{timestamp}.pdf"
    
    font_config = FontConfiguration()
    
    # Fetch Tailwind CSS manually to avoid WeasyPrint internal fetcher issues on some Windows setups
    # skipped manual fetch
    stylesheets = []

    
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>WeasyPrint + Tailwind CSS Dashboard</title>
        
        <!-- Link to Tailwind CSS v1.0 (Lighter and often more compatible with PDF renderers) -->
        <link href="https://unpkg.com/tailwindcss@1.0.4/dist/tailwind.min.css" rel="stylesheet">
        
        <style>
            /* WeasyPrint-specific page rules (Tailwind doesn't adhere to @page) */
            @page {
                size: A4 landscape; /* Landscape for a dashboard view */
                margin: 0;
            }
            @media print {
                body { -webkit-print-color-adjust: exact; } /* Ensure colors print correctly */
            }
            /* Custom fonts to look like a modern app */
            body { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        </style>
    </head>
    <body class="bg-gray-100 text-gray-800 antialiased p-8">

        <!-- Top Header -->
        <div class="max-w-7xl mx-auto mb-10 flex justify-between items-center border-b-2 border-gray-300 pb-4">
            <div>
                <h1 class="text-4xl font-extrabold text-blue-900 tracking-tight">Financial Overview</h1>
                <p class="text-gray-500 mt-2 text-lg">Q4 2025 Performance Report</p>
            </div>
            <div class="text-right">
                <div class="inline-block bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-semibold shadow-sm">
                    CONFIDENTIAL
                </div>
                <p class="text-sm text-gray-400 mt-1">Generated: """ + timestamp + """</p>
            </div>
        </div>

        <!-- KPI Cards Grid -->
        <div class="max-w-7xl mx-auto grid grid-cols-4 gap-6 mb-10">
            <!-- Card 1 -->
            <div class="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                <div class="text-gray-500 text-sm uppercase font-bold tracking-wider">Total Revenue</div>
                <div class="text-3xl font-bold text-gray-900 mt-2">$4,290.50</div>
                <div class="text-green-500 text-sm font-semibold mt-2 flex items-center">
                    <span>▲ 12.5%</span> <span class="text-gray-400 ml-2 font-normal">vs last month</span>
                </div>
            </div>
            
            <!-- Card 2 -->
            <div class="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
                <div class="text-gray-500 text-sm uppercase font-bold tracking-wider">Active Users</div>
                <div class="text-3xl font-bold text-gray-900 mt-2">18,402</div>
                <div class="text-green-500 text-sm font-semibold mt-2">
                    <span>▲ 5.2%</span> <span class="text-gray-400 ml-2 font-normal">new signups</span>
                </div>
            </div>

            <!-- Card 3 -->
            <div class="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
                <div class="text-gray-500 text-sm uppercase font-bold tracking-wider">Bounce Rate</div>
                <div class="text-3xl font-bold text-gray-900 mt-2">42.3%</div>
                <div class="text-red-500 text-sm font-semibold mt-2">
                    <span>▼ 2.1%</span> <span class="text-gray-400 ml-2 font-normal">needs attention</span>
                </div>
            </div>

            <!-- Card 4 -->
            <div class="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
                <div class="text-gray-500 text-sm uppercase font-bold tracking-wider">Avg. Session</div>
                <div class="text-3xl font-bold text-gray-900 mt-2">4m 32s</div>
                <div class="text-green-500 text-sm font-semibold mt-2">
                    <span>▲ 12s</span> <span class="text-gray-400 ml-2 font-normal">improved</span>
                </div>
            </div>
        </div>

        <!-- Main Content Grid -->
        <div class="max-w-7xl mx-auto grid grid-cols-3 gap-8">
            
            <!-- Large Main Section (2 Cols) -->
            <div class="col-span-2 space-y-8">
                
                <!-- Transaction Table -->
                <div class="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                        <h3 class="text-lg font-bold text-gray-800">Recent Large Transactions</h3>
                        <span class="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full">Last 30 Days</span>
                    </div>
                    <table class="w-full text-left">
                        <thead>
                            <tr class="bg-gray-50 text-gray-500 text-sm uppercase">
                                <th class="px-6 py-3 font-medium">Customer</th>
                                <th class="px-6 py-3 font-medium">Date</th>
                                <th class="px-6 py-3 font-medium">Status</th>
                                <th class="px-6 py-3 font-medium text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 text-sm">
                            <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4 font-medium text-gray-900">TechCorp Solutions</td>
                                <td class="px-6 py-4 text-gray-500">Dec 15, 2025</td>
                                <td class="px-6 py-4"><span class="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold">Completed</span></td>
                                <td class="px-6 py-4 text-right font-bold">$2,400.00</td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4 font-medium text-gray-900">Global Logistics Inc.</td>
                                <td class="px-6 py-4 text-gray-500">Dec 14, 2025</td>
                                <td class="px-6 py-4"><span class="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-semibold">Pending</span></td>
                                <td class="px-6 py-4 text-right font-bold">$1,250.00</td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4 font-medium text-gray-900">Creative Studios</td>
                                <td class="px-6 py-4 text-gray-500">Dec 12, 2025</td>
                                <td class="px-6 py-4"><span class="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-semibold">Processing</span></td>
                                <td class="px-6 py-4 text-right font-bold">$850.00</td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4 font-medium text-gray-900">StartUp Ventures</td>
                                <td class="px-6 py-4 text-gray-500">Dec 10, 2025</td>
                                <td class="px-6 py-4"><span class="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-semibold">Failed</span></td>
                                <td class="px-6 py-4 text-right font-bold">$120.00</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Complex Grid Layout for Stats -->
                <div class="grid grid-cols-2 gap-6">
                    <div class="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl shadow-lg p-6 text-white text-center">
                        <div class="text-indigo-200 text-sm font-semibold mb-2">PROJECTED GROWTH</div>
                        <div class="text-5xl font-extrabold mb-2">+28%</div>
                        <div class="text-indigo-100 text-sm opacity-80">Better than 95% of competitors</div>
                        <div class="mt-6">
                            <div class="h-2 bg-indigo-900 rounded-full overflow-hidden">
                                <div class="h-full bg-white w-3/4"></div>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-xl shadow-lg p-6 flex flex-col justify-center items-center border border-gray-100">
                         <!-- Visual Circle (SVG) -->
                         <div class="relative w-32 h-32">
                            <svg class="w-full h-full transform -rotate-90">
                                <circle cx="64" cy="64" r="56" stroke="currentColor" stroke-width="12" fill="transparent" class="text-gray-100" />
                                <circle cx="64" cy="64" r="56" stroke="currentColor" stroke-width="12" fill="transparent" stroke-dasharray="351" stroke-dashoffset="80" class="text-blue-500" />
                            </svg>
                            <span class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-2xl font-bold text-gray-700">75%</span>
                         </div>
                         <p class="mt-4 text-gray-500 font-medium">Goal Completion</p>
                    </div>
                </div>
            </div>

            <!-- Right Sidebar (1 Col) -->
            <div class="col-span-1 space-y-6">
                <!-- User Profile -->
                <div class="bg-white rounded-xl shadow-md p-6 text-center">
                    <div class="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-4 border-4 border-white shadow-sm flex items-center justify-center text-3xl">👤</div>
                    <h3 class="text-xl font-bold text-gray-900">Alex Morgan</h3>
                    <p class="text-blue-600 font-medium">Senior Analyst</p>
                    <div class="mt-6 flex justify-center space-x-2">
                        <span class="bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full uppercase font-bold tracking-wide">Admin</span>
                        <span class="bg-purple-50 text-purple-700 text-xs px-3 py-1 rounded-full uppercase font-bold tracking-wide">Pro</span>
                    </div>
                </div>

                <!-- Notifications / List -->
                <div class="bg-white rounded-xl shadow-md p-6">
                    <h4 class="font-bold text-gray-800 mb-4 border-b pb-2">Activity Log</h4>
                    <ul class="space-y-4">
                        <li class="flex items-start">
                            <div class="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-blue-500"></div>
                            <div class="ml-3">
                                <p class="text-sm text-gray-700 font-medium">Report generated</p>
                                <p class="text-xs text-gray-400">Just now</p>
                            </div>
                        </li>
                        <li class="flex items-start">
                            <div class="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-green-500"></div>
                            <div class="ml-3">
                                <p class="text-sm text-gray-700 font-medium">Data sync completed</p>
                                <p class="text-xs text-gray-400">2 hours ago</p>
                            </div>
                        </li>
                        <li class="flex items-start">
                            <div class="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-yellow-500"></div>
                            <div class="ml-3">
                                <p class="text-sm text-gray-700 font-medium">Subscription updated</p>
                                <p class="text-xs text-gray-400">Yesterday</p>
                            </div>
                        </li>
                    </ul>
                </div>
                
                <!-- Footer Note -->
                <div class="bg-blue-900 rounded-xl shadow-md p-6 text-white text-sm opacity-90">
                    <p class="font-bold mb-2">Did you know?</p>
                    <p>WeasyPrint can handle complex nested grids like this one with ease as long as the CSS is valid!</p>
                </div>
            </div>
        </div>

    </body>
    </html>
    """

    print(f"Generating Tailwind PDF (this may take a moment to fetch CSS): {output_filename}...")
    
    try:
        # Generate the PDF
        HTML(string=html_content).write_pdf(
            output_filename,
            stylesheets=stylesheets,
            optimize_images=True
        )
        
        print(f"Successfully generated {output_filename}")

    except Exception as e:
        print(f"Error generating PDF: {e}")

if __name__ == "__main__":
    generate_complex_pdf()
