document.getElementById('fetch-button').addEventListener('click', async () => {
    const statusMessage = document.getElementById('status-message');
    const ratesDisplay = document.getElementById('rates-display');
    const resultBox = document.getElementById('result-box');
    
    statusMessage.style.display = 'none';
    statusMessage.className = '';
    ratesDisplay.innerHTML = '';
    resultBox.style.display = 'none';

    try {
        statusMessage.innerText = 'جاري جلب الأسعار وإرسالها إلى RabbitMQ...';
        statusMessage.className = 'success';
        statusMessage.style.display = 'block';
        
        const response = await fetch('/api/fetch-and-send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            statusMessage.innerText = data.message;
            statusMessage.className = 'success';
            
            // Display the rates that were sent
            let html = '';
            // Only display a few key rates to keep it clean
            const keysToDisplay = ['USD', 'EUR', 'SAR', 'KWD', 'GBP'];
            
            for (const key of keysToDisplay) {
                if (data.rates[key]) {
                    html += `<div class="rate-item">1 USD = <strong>${data.rates[key].toFixed(4)}</strong> ${key}</div>`;
                }
            }
            
            ratesDisplay.innerHTML = html;
            resultBox.style.display = 'block';

        } else {
            statusMessage.innerText = `فشل: ${data.message || 'حدث خطأ غير معروف'}`;
            statusMessage.className = 'error';
        }

    } catch (error) {
        statusMessage.innerText = `خطأ في الاتصال: ${error.message}. تأكد من أن الخادم يعمل.`;
        statusMessage.className = 'error';
    }
});
