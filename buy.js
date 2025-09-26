// public/buy.js
const SERVER_BASE = 'https://cb-9.onrender.com';

const buyButtons = document.querySelectorAll('.buyBtn');
const messageDiv = document.getElementById('message');

if (!messageDiv) {
  console.warn('No #message element found on page — create it to show statuses.');
}

buyButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    const product = btn.dataset.product;
    if (!product) return;

    // clear previous
    if (messageDiv) messageDiv.innerHTML = '';

    try {
      const res = await fetch(`${SERVER_BASE}/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product })
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('create-checkout failed', data);
        if (messageDiv) messageDiv.textContent = (data && data.error) ? data.error : 'Failed to create checkout. Try again.';
        return;
      }

      const { checkoutUrl, orderId } = data;
      if (!checkoutUrl || !orderId) {
        if (messageDiv) messageDiv.textContent = 'Failed to create checkout. Try again.';
        return;
      }

      // open checkout in new tab/window
      window.open(checkoutUrl, '_blank');

      // show friendly message
      if (messageDiv) {
        messageDiv.innerHTML = `
          Checkout opened. Complete the payment.<br>
          <span style="color:#FF3697; font-weight:normal;">
            Please do not close or refresh this page during payment — your download link will appear here once the transaction is complete!
          </span>
        `;
      }

      // Polling: check /download/:orderId for redeemUrl
      const interval = setInterval(async () => {
        try {
          const dl = await fetch(`${SERVER_BASE}/download/${encodeURIComponent(orderId)}`);
          const dlData = await dl.json();

          // if redeemUrl provided by server -> show link
          if (dlData && dlData.redeemUrl) {
            clearInterval(interval);
            // show final link (one-time). The link will call /redeem/:token which returns fileUrl
            const redeemUrl = dlData.redeemUrl;
            if (messageDiv) {
              messageDiv.innerHTML = `
                Payment confirmed!<br>
                <a id="redeemLink" href="${redeemUrl}" target="_blank" style="color:lime;">Download your product</a>
                <div style="font-size:0.85rem;color:#ddd;margin-top:6px;">The link can be used once — it'll expire after use or 1 hour.</div>
              `;
            }

            // Optionally auto-call redeem to fetch fileUrl and open it directly:
            // (If you prefer immediate redirect to file without extra click, uncomment:
            /*
            try {
              const r = await fetch(redeemUrl);
              const rd = await r.json();
              if (rd && rd.fileUrl) window.open(rd.fileUrl, '_blank');
            } catch(e){ console.error('redeem error', e); }
            */
          }
        } catch (e) {
          console.error('download poll error', e);
        }
      }, 3000);

      // timeout polling after e.g. 20 minutes
      setTimeout(() => clearInterval(interval), 20 * 60 * 1000);

    } catch (err) {
      console.error('create-checkout error', err);
      if (messageDiv) messageDiv.textContent = 'Server error. Try again later.';
    }
  });
});
