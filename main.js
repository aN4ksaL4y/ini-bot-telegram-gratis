const telegramAuthToken = ``; 
const API_KEY = "";
const gemini_url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

const webhookEndpoint = "/endpoint";
addEventListener("fetch", event => {
    event.respondWith(handleIncomingRequest(event));
});


async function handleIncomingRequest(event) {
    let url = new URL(event.request.url);
    let path = url.pathname;
    let method = event.request.method;
    let workerUrl = `${url.protocol}//${url.host}`;

    if (method === "POST" && path === webhookEndpoint) {
        const update = await event.request.json();
        event.waitUntil(processUpdate(update));
        return new Response("Ok");

    } else if (method === "GET" && path === "/configure-webhook") {
        const url = `https://api.telegram.org/bot${telegramAuthToken}/setWebhook?url=${workerUrl}${webhookEndpoint}`;

        const response = await fetch(url);

        if (response.ok) {
            return new Response("Webhook set successfully", { status: 200 });
        } else {
            return new Response("Failed to set webhook", { status: response.status });
        }
    } else {
        return new Response("Not found", { status: 404 });
    }

}

// ini simple respon dari gemini
async function generateContent(prompt) {
    const data = {
        contents: [{ parts: [{ text: prompt }] }]
    };

    const response = await fetch(gemini_url, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    if (response.ok) {
        const responseData = await response.json();
        return responseData.candidates[0].content.parts[0].text;
    } else {
        console.error("Error:", response.status);
        return null;
    }
}

async function sendMessage(chatId, responseText) {
    const url = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage`;

    const payload = {
        chat_id: chatId,
        text: responseText
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error("Failed to send message:", response.status, await response.text());
        }
    } catch (error) {
        console.error("Error sending message:", error);
    }
}

// ini yang handle pesan masuk ke bot
async function processUpdate(update) {
    console.log("Received update:", JSON.stringify(update, null, 2)); // Log the incoming update

    if ("message" in update) {
        const chatId = update.message.chat.id;
        const userText = update.message.text;
        const chatType = update.message.chat.type; // Determine the type of chat

        const userName = update.message.from.first_name; // Get user's first name
        if (userText && chatType === 'group'){
            const responseText = await sendMessage(chatId, `ini group`); // Await the response
        }

        if (userText.startsWith('gem')) { // Changed to /ai command
            const prompt = userText.split('gem')[1].trim();
            const responseText = await generateContent(prompt); // Await the response
            console.log("Generated response:", responseText);

            if (responseText) {
                // Respond with the user's name in a group chat
                const replyText = chatType === 'group' ? `${userName}, here's your response: ${responseText}` : responseText;
                await sendMessage(chatId, replyText); // Await sendMessage
            } else {
                await sendMessage(chatId, "Sorry, I couldn't generate a response.");
            }
        } else {
            const responseText = `
User input: ${userText}
Prefixes:
gem: <prompt disini> (chatbot ai)
            `;
            console.log(responseText);
            await sendMessage(chatId, responseText); // Respond with echo
        }
    }
}