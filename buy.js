const buyButtons = document.querySelectorAll('.buyBtn');
const messageDiv = document.getElementById('message');

buyButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    const product = btn.dataset.product;

    // Очищаем предыдущее сообщение
    messageDiv.innerHTML = '';

    try {
      // Отправляем запрос на сервер для создания checkout
      const response = await fetch('https://cb-9.onrender.com/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product })
      });

      const data = await response.json();

      if (data.checkoutUrl && data.orderId) {
        // Открываем окно оплаты Coinbase
        window.open(data.checkoutUrl, '_blank');

        // Показываем сообщение пользователю
        messageDiv.innerHTML = `
          Checkout opened. Complete the payment.<br>
          <span style="color:#FF3697; font-weight:normal;">
          Please do not close or refresh this page during payment — your download link will appear here once the transaction is complete!
          </span>
        `;

        // Проверяем каждые 3 секунды, доступен ли файл для скачивания
        const interval = setInterval(async () => {
          const downloadResp = await fetch(`https://cb-9.onrender.com/download/${data.orderId}`);
          const downloadData = await downloadResp.json();

          if (downloadData.fileUrl) {
            clearInterval(interval);
            messageDiv.innerHTML = `
              Payment confirmed! <br>
              <a href="${downloadData.fileUrl}" target="_blank" style="color:lime;">Download your product</a>
            `;
          }
        }, 3000);

      } else {
        messageDiv.textContent = 'Failed to create checkout. Try again.';
      }

    } catch (err) {
      console.error(err);
      messageDiv.textContent = 'Server error. Try again later.';
    }
  });
});
