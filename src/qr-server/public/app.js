class OTPCheckinApp {
    constructor() {
        this.qrCodeElement = document.getElementById('qr-code');
        this.countdownElement = document.getElementById('countdown');
        this.errorElement = document.getElementById('error-message');
        this.retryButton = document.getElementById('retry-btn');

        this.currentOTP = null;
        this.countdownTimer = null;
        this.refreshTimer = null;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.retryDelay = 2000; // Start with 2 seconds

        this.init();
    }

    init() {
        this.retryButton.addEventListener('click', () => {
            this.retryCount = 0; // Reset retry count on manual retry
            this.loadCurrentOTP();
        });
        this.loadCurrentOTP();
    }

    async loadCurrentOTP() {
        try {
            this.hideError();
            this.showLoading();

            // Use the backend QR code generation endpoint
            const response = await fetch('/api/current-otp-with-qr?format=mobile&size=200', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            // Handle API response format with success/data structure
            if (!result.success) {
                throw new Error(result.error?.message || 'Failed to get OTP');
            }

            this.currentOTP = result.data;
            this.retryCount = 0; // Reset retry count on success

            // Display QR code from backend-generated data URL
            this.displayQRCodeFromDataURL(result.data.qrCodeDataURL, result.data.whatsappURL);

            this.startCountdown(result.data.expiresIn || 30);

        } catch (error) {
            console.error('Failed to load OTP:', error);
            this.handleError(error);
        }
    }

    async handleError(error) {
        this.retryCount++;

        if (this.retryCount <= this.maxRetries) {
            console.log(`Retrying in ${this.retryDelay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
            this.showRetrying();

            setTimeout(() => {
                this.loadCurrentOTP();
            }, this.retryDelay);

            // Exponential backoff
            this.retryDelay = Math.min(this.retryDelay * 2, 10000);
        } else {
            this.showError(error.message);
            this.retryDelay = 2000; // Reset delay for manual retry
        }
    }

    displayQRCodeFromDataURL(qrCodeDataURL, whatsappUrl) {
        try {
            // Clear previous QR code
            this.qrCodeElement.innerHTML = '';

            // Create image element for QR code
            const img = document.createElement('img');
            img.src = qrCodeDataURL;
            // Use the WhatsApp URL as alt text for accessibility
            img.alt = `QR Code for WhatsApp Check-in: ${whatsappUrl}`;
            img.style.width = '200px';
            img.style.height = '200px';

            // Add image to DOM
            this.qrCodeElement.appendChild(img);

        } catch (error) {
            console.error('Failed to display QR code:', error);
            this.showError('Failed to display QR code. Please try again.');
        }
    }

    async getWhatsAppURL(otp) {
        try {
            // Use the new backend endpoint for WhatsApp URL generation
            const response = await fetch(`/api/whatsapp-url/${otp}?format=mobile&qrOptimized=true`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error?.message || 'Failed to get WhatsApp URL');
            }

            return result.data.url;
        } catch (error) {
            console.error('Failed to get WhatsApp URL from backend, using fallback:', error);
            // Fallback to basic URL generation if backend fails
            return this.generateFallbackWhatsAppURL(otp);
        }
    }

    generateFallbackWhatsAppURL(otp) {
        // Fallback WhatsApp URL generation for offline/error scenarios
        const defaultNumber = '84853920477';
        const message = `Check-in code: ${otp}`;
        return `https://wa.me/${defaultNumber}?text=${encodeURIComponent(message)}`;
    }

    async getWhatsAppConfig() {
        try {
            const response = await fetch('/api/whatsapp-config', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error?.message || 'Failed to get WhatsApp config');
            }

            return result.data;
        } catch (error) {
            console.error('Failed to get WhatsApp config:', error);
            return null;
        }
    }

    startCountdown(seconds) {
        this.clearTimers();

        let timeLeft = Math.max(0, Math.floor(seconds));
        this.updateCountdownDisplay(timeLeft);

        this.countdownTimer = setInterval(() => {
            timeLeft--;
            this.updateCountdownDisplay(timeLeft);

            if (timeLeft <= 0) {
                this.clearTimers();
                // Add a small delay before refreshing to ensure we get the new OTP
                setTimeout(() => {
                    this.loadCurrentOTP();
                }, 500);
            }
        }, 1000);
    }

    updateCountdownDisplay(seconds) {
        const displaySeconds = Math.max(0, seconds);
        this.countdownElement.textContent = displaySeconds;

        // Update timer container class for styling
        const timerContainer = this.countdownElement.parentElement;
        timerContainer.className = 'timer';

        // Change color and add urgency styling as time runs out
        if (displaySeconds <= 5) {
            this.countdownElement.style.color = '#dc3545'; // Red
            timerContainer.classList.add('urgent');
        } else if (displaySeconds <= 10) {
            this.countdownElement.style.color = '#ffc107'; // Yellow
            timerContainer.classList.add('warning');
        } else {
            this.countdownElement.style.color = '#28a745'; // Green
        }

        // Add pulse animation for last 5 seconds
        if (displaySeconds <= 5 && displaySeconds > 0) {
            timerContainer.classList.add('pulse');
        } else {
            timerContainer.classList.remove('pulse');
        }
    }

    showLoading() {
        this.qrCodeElement.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading QR code...</p></div>';
    }

    showRetrying() {
        this.qrCodeElement.innerHTML = `<div class="loading"><div class="spinner"></div><p>Retrying... (${this.retryCount}/${this.maxRetries})</p></div>`;
    }

    showError(message = 'Unable to generate QR code') {
        this.errorElement.querySelector('p').textContent = `${message}. `;
        this.errorElement.classList.remove('hidden');
        this.qrCodeElement.innerHTML = '<div class="loading error-state">Failed to load QR code</div>';
    }

    hideError() {
        this.errorElement.classList.add('hidden');
    }

    clearTimers() {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new OTPCheckinApp();
});