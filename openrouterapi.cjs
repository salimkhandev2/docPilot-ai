const OpenAI = require('openai').default;
require('dotenv').config();

// OpenRouter API configuration using OpenAI SDK
const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY
});

// All available models to test
const MODELS = [
    "z-ai/glm-4.5-air:free",
    "arcee-ai/trinity-mini:free",
    "kwaipilot/kat-coder-pro:free",
    "tngtech/deepseek-r1t2-chimera:free",
    "mistralai/devstral-2512:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "amazon/nova-2-lite-v1:free",
    "openai/gpt-oss-20b:free",
    "google/gemma-3-27b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "nex-agi/deepseek-v3.1-nex-n1:free",
    "alibaba/tongyi-deepresearch-30b-a3b:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "nvidia/nemotron-nano-9b-v2:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "qwen/qwen3-4b:free",
    "google/gemma-3-12b-it:free",
    "google/gemma-3n-e2b-it:free",
    "google/gemma-3-4b-it:free"
];

// Function to test a single model with STREAMING (using OpenAI SDK)
async function testModel(model, prompt = "Hi") {
    console.log(`\n🤖 Testing model: ${model}`);
    console.log(`📝 Prompt: "${prompt}"`);
    console.log('-'.repeat(50));

    try {
        const startTime = Date.now();
        let fullResponse = '';

        // Create streaming completion using OpenAI SDK
        const stream = await client.chat.completions.create({
            model: model,
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 4000,
            temperature: 0.7,
            stream: true  // Enable streaming
        });

        process.stdout.write('✅ Streaming: ');

        // Clean async iteration - just like Google's SDK!
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                process.stdout.write(content);
                fullResponse += content;
            }
        }

        const endTime = Date.now();
        const responseTime = ((endTime - startTime) / 1000).toFixed(2);

        console.log(`\n\n⏱️  Completed in ${responseTime}s`);
        console.log('-'.repeat(50));

        return { model, success: true, response: fullResponse, time: responseTime };
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        console.log('-'.repeat(50));
        return { model, success: false, error: error.message };
    }
}

// Test a single model (default: first in list)
async function testSingleModel(modelIndex = 0, prompt = "Hi") {
    if (modelIndex >= MODELS.length) {
        console.log('❌ Invalid model index');
        return;
    }
    await testModel(MODELS[modelIndex], prompt);
}

// Test all models sequentially
async function testAllModels(prompt = "Hi") {
    console.log('🚀 Testing all OpenRouter models...');
    console.log(`📋 Total models: ${MODELS.length}`);
    console.log('='.repeat(50));

    const results = [];

    for (const model of MODELS) {
        const result = await testModel(model, prompt);
        results.push(result);
        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 SUMMARY');
    console.log('='.repeat(50));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ Successful: ${successful.length}/${MODELS.length}`);
    console.log(`❌ Failed: ${failed.length}/${MODELS.length}`);

    if (failed.length > 0) {
        console.log('\n❌ Failed models:');
        failed.forEach(r => console.log(`   - ${r.model}: ${r.error}`));
    }
}

// Main execution
async function main() {
    // Check if API key exists
    if (!process.env.OPENROUTER_API_KEY) {
        console.log('❌ Error: OPENROUTER_API_KEY not found in .env file');
        console.log('Please add your API key to .env file:');
        console.log('OPENROUTER_API_KEY=your_api_key_here');
        return;
    }

    console.log('🔑 API Key found');
    console.log('='.repeat(50));

    // Get command line arguments
    const args = process.argv.slice(2);
    const mode = args[0] || 'single';  // 'single' or 'all'
    const modelIndex = parseInt(args[1]) || 0;
    const prompt = args[2] || 'Hi';

    if (mode === 'all') {
        // Test all models
        await testAllModels(prompt);
    } else {
        // Test single model (default)
        console.log('\n📌 Testing single model...');
        console.log('💡 Usage: node openrouterapi.cjs single [modelIndex] [prompt]');
        console.log('💡 Usage: node openrouterapi.cjs all [prompt]');
        console.log(`\n📋 Available models (0-${MODELS.length - 1}):`);
        MODELS.forEach((m, i) => console.log(`   ${i}: ${m}`));
        console.log('');

        await testSingleModel(modelIndex, prompt);
    }
}

main();
