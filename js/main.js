// ================================
// SCROLL ANIMATIONS
// ================================

// Intersection Observer for fade-in animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

// Add fade-in animation to sections on page load
document.addEventListener('DOMContentLoaded', () => {
    // Animate sections
    const sections = document.querySelectorAll('section');
    sections.forEach((section, index) => {
        section.classList.add('fade-in');
        section.style.transitionDelay = `${index * 0.1}s`;
        observer.observe(section);
    });

    // Animate benefit cards
    const benefitCards = document.querySelectorAll('.benefit-card');
    benefitCards.forEach((card, index) => {
        card.classList.add('fade-in');
        card.style.transitionDelay = `${index * 0.1}s`;
        observer.observe(card);
    });

    // Animate fit items
    const fitItems = document.querySelectorAll('.fit-item');
    fitItems.forEach((item, index) => {
        item.classList.add('slide-in-left');
        item.style.transitionDelay = `${index * 0.08}s`;
        observer.observe(item);
    });

    // Animate testimonials
    const testimonials = document.querySelectorAll('.testimonial-card');
    testimonials.forEach((testimonial, index) => {
        testimonial.classList.add('fade-in');
        testimonial.style.transitionDelay = `${index * 0.15}s`;
        observer.observe(testimonial);
    });

    // Show cookie notice after 2 seconds
    setTimeout(() => {
        const cookieNotice = document.getElementById('cookieNotice');
        const cookieAccepted = localStorage.getItem('cookiesAccepted');
        if (!cookieAccepted) {
            cookieNotice.classList.add('show');
        }
    }, 2000);
});

// ================================
// SMOOTH SCROLL TO VIDEO
// ================================

function scrollToVideo() {
    const videoSection = document.querySelector('.video-section');
    videoSection.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
}

// ================================
// COOKIE NOTICE
// ================================

function acceptCookies() {
    localStorage.setItem('cookiesAccepted', 'true');
    const cookieNotice = document.getElementById('cookieNotice');
    cookieNotice.style.opacity = '0';
    cookieNotice.style.transform = 'translateY(100%)';
    cookieNotice.style.transition = 'all 0.4s ease';
    
    setTimeout(() => {
        cookieNotice.classList.remove('show');
        cookieNotice.style.display = 'none';
    }, 400);
}

// ================================
// BUTTON CLICK ANIMATIONS
// ================================

document.addEventListener('DOMContentLoaded', () => {
    const ctaButton = document.querySelector('.cta-button');
    
    if (ctaButton) {
        ctaButton.addEventListener('click', function(e) {
            // Create ripple effect
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    }
});

// Add ripple styles dynamically
const style = document.createElement('style');
style.textContent = `
    .cta-button {
        position: relative;
        overflow: hidden;
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        transform: scale(0);
        animation: ripple-animation 0.6s ease-out;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ================================
// SCROLL PROGRESS INDICATOR
// ================================

// Create scroll progress bar
const progressBar = document.createElement('div');
progressBar.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0%;
    height: 4px;
    background: linear-gradient(90deg, #A8D8EA 0%, #8FCCE0 100%);
    z-index: 9999;
    transition: width 0.1s ease;
`;
document.body.appendChild(progressBar);

window.addEventListener('scroll', () => {
    const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (window.pageYOffset / windowHeight) * 100;
    progressBar.style.width = scrolled + '%';
});

// ================================
// VIDEO PLAYER ENHANCEMENT
// ================================

document.addEventListener('DOMContentLoaded', () => {
    const videoWrapper = document.querySelector('.video-wrapper');
    
    if (videoWrapper) {
        // Add loading animation
        videoWrapper.style.position = 'relative';
        
        const loader = document.createElement('div');
        loader.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 50px;
            height: 50px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #A8D8EA;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            z-index: 1;
        `;
        
        videoWrapper.appendChild(loader);
        
        // Remove loader when iframe loads
        const iframe = videoWrapper.querySelector('iframe');
        iframe.addEventListener('load', () => {
            loader.style.opacity = '0';
            loader.style.transition = 'opacity 0.3s ease';
            setTimeout(() => loader.remove(), 300);
        });
    }
});

// Add spinner animation
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
    @keyframes spin {
        0% { transform: translate(-50%, -50%) rotate(0deg); }
        100% { transform: translate(-50%, -50%) rotate(360deg); }
    }
`;
document.head.appendChild(spinnerStyle);

// ================================
// PARALLAX EFFECT ON SCROLL
// ================================

let ticking = false;

window.addEventListener('scroll', () => {
    if (!ticking) {
        window.requestAnimationFrame(() => {
            const scrolled = window.pageYOffset;
            
            // Parallax effect on CTA section
            const ctaSection = document.querySelector('.cta-section');
            if (ctaSection) {
                const ctaTop = ctaSection.offsetTop;
                const windowHeight = window.innerHeight;
                if (scrolled + windowHeight > ctaTop) {
                    const distance = scrolled + windowHeight - ctaTop;
                    const parallax = distance * 0.15;
                    ctaSection.style.transform = `translateY(-${parallax}px)`;
                }
            }
            
            ticking = false;
        });
        
        ticking = true;
    }
});

// ================================
// FOOTER LINKS HANDLING
// ================================

document.addEventListener('DOMContentLoaded', () => {
    const footerLinks = document.querySelectorAll('.footer-link');
    
    footerLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            
            // You can customize this to show modals or navigate to pages
            console.log('Footer link clicked:', href);
            alert('This would navigate to: ' + href.replace('#', ''));
        });
    });
});

// ================================
// MOBILE MENU ENHANCEMENTS
// ================================

// Prevent scroll when focusing on inputs on mobile
if (window.innerWidth < 768) {
    document.addEventListener('focusin', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            setTimeout(() => {
                e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    });
}

// ================================
// PERFORMANCE OPTIMIZATION
// ================================

// Lazy load images if any are added later
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                imageObserver.unobserve(img);
            }
        });
    });

    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

// ================================
// ACCESSIBILITY ENHANCEMENTS
// ================================

// Add keyboard navigation support
document.addEventListener('DOMContentLoaded', () => {
    const focusableElements = document.querySelectorAll(
        'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    
    focusableElements.forEach(element => {
        element.addEventListener('focus', function() {
            this.style.outline = '3px solid #A8D8EA';
            this.style.outlineOffset = '2px';
        });
        
        element.addEventListener('blur', function() {
            this.style.outline = '';
            this.style.outlineOffset = '';
        });
    });
});

// ================================
// CONSOLE WELCOME MESSAGE
// ================================

console.log('%c🎵 The Self-Producing Artist System', 'font-size: 20px; font-weight: bold; color: #A8D8EA;');
console.log('%cBuilt with ❤️ by New Era Artist™', 'font-size: 14px; color: #666;');
console.log('%cWebsite loaded successfully!', 'font-size: 12px; color: #4CAF50;');