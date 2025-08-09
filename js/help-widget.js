export default function initHelpWidget() {
    const toggleButton = document.getElementById('help-toggle-btn');
    const chatWidget = document.getElementById('help-chat-widget');
    const closeButton = document.getElementById('chat-close-btn');
    const helpForm = document.getElementById('help-form');
    const helpInput = document.getElementById('help-input');
    const messagesContainer = document.getElementById('chat-messages');

    if (!toggleButton || !chatWidget) return;

    // Yardım penceresini aç/kapat
    toggleButton.addEventListener('click', () => {
        const isHidden = chatWidget.style.display === 'none';
        chatWidget.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) {
            helpInput.focus();
        }
    });

    closeButton.addEventListener('click', () => {
        chatWidget.style.display = 'none';
    });

    // Form gönderildiğinde
    helpForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const form = e.target;
        const data = new FormData(form);
        const userMessage = data.get('message').trim();
        const action = form.action;
        const submitButton = form.querySelector('button[type="submit"]');

        if (!userMessage) return;

        // 1. Kullanıcının mesajını ekrana ekle
        appendMessage(userMessage, 'user-message');
        helpInput.value = '';
        submitButton.disabled = true;

        // 2. Formu gönder (contactForm.js'teki mantık)
        fetch(action, {
            method: 'POST',
            body: data,
            headers: { 'Accept': 'application/json' }
        }).then(response => {
            if (response.ok) {
                // 3. Başarılı olursa bot'tan teşekkür mesajı göster
                const successMessage = "Thank you! Your message has been sent. We'll get back to you shortly.";
                appendMessage(successMessage, 'bot-message');
                form.reset();
            } else {
                // 4. Hata olursa hata mesajı göster
                response.json().then(data => {
                    const errorMessage = data.errors ? data.errors.map(e => e.message).join(", ") : "Oops! There was a problem sending your message.";
                    appendMessage(errorMessage, 'bot-message');
                });
            }
        }).catch(() => {
            // 5. Ağ hatası olursa hata mesajı göster
            const networkError = "Oops! A network error occurred. Please check your connection and try again.";
            appendMessage(networkError, 'bot-message');
        }).finally(() => {
            // 6. Butonu tekrar aktif et
            submitButton.disabled = false;
        });
    });

    // Mesajları ekrana ekleyen yardımcı fonksiyon
    function appendMessage(text, className) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', className);
        messageDiv.textContent = text;
        messagesContainer.appendChild(messageDiv);
        // Otomatik olarak en alta kaydır
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}