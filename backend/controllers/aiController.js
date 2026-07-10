const axios = require('axios');
const FormData = require('form-data');

// @desc    Generate AI Design
// @route   POST /api/ai/generate
// @access  Public (should be protected in prod)
exports.generateDesign = async (req, res) => {
    try {
        const { prompt } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ success: false, message: 'Please provide a prompt' });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        
        if (!apiKey || apiKey === 'YOUR_OPENAI_API_KEY') {
            console.log('No OpenAI API key provided. Returning mock generated image for testing.');
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            return res.status(200).json({
                success: true,
                data: [
                    { url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop' }
                ]
            });
        }

        // Make real request to OpenAI DALL-E
        const response = await axios.post(
            'https://api.openai.com/v1/images/generations',
            {
                prompt: prompt,
                n: 1,
                size: '1024x1024',
                model: 'dall-e-3' // or dall-e-2 depending on cost preference
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({
            success: true,
            data: response.data.data
        });

    } catch (error) {
        console.error('AI Generation Error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to generate design. ' + (error.response?.data?.error?.message || error.message)
        });
    }
};

// @desc    Remove Background from image
// @route   POST /api/ai/remove-bg
// @access  Public (should be protected in prod)
exports.removeBackground = async (req, res) => {
    try {
        const { imageUrl } = req.body; // Can accept URL or base64. For simplicity, we accept URL here.
        
        if (!imageUrl) {
            return res.status(400).json({ success: false, message: 'Please provide an image URL' });
        }

        const apiKey = process.env.REMOVE_BG_API_KEY;
        
        if (!apiKey || apiKey === 'YOUR_REMOVE_BG_API_KEY') {
            console.log('No RemoveBG API key provided. Returning original image for testing.');
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            return res.status(200).json({
                success: true,
                url: imageUrl // Fallback to original image if no key
            });
        }

        const formData = new FormData();
        formData.append('image_url', imageUrl);
        formData.append('size', 'auto');

        const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
            headers: {
                ...formData.getHeaders(),
                'X-Api-Key': apiKey
            },
            responseType: 'arraybuffer'
        });

        // Convert arraybuffer to base64
        const base64Image = Buffer.from(response.data, 'binary').toString('base64');
        const finalUrl = `data:image/png;base64,${base64Image}`;

        res.status(200).json({
            success: true,
            url: finalUrl
        });

    } catch (error) {
        console.error('Background Removal Error:', error.response?.data ? error.response.data.toString() : error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to remove background. ' + error.message
        });
    }
};
