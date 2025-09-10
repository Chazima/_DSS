// Animation for fade-in effect when page loads
window.addEventListener('load', function() {
    document.querySelector('.form-container').classList.add('fadeIn');
});

// Handle toggling between login and register forms
document.getElementById('show-register').addEventListener('click', function() {
    document.querySelector('.login-form').classList.add('hidden');
    document.querySelector('.register-form').classList.remove('hidden');
});

document.getElementById('show-login').addEventListener('click', function() {
    document.querySelector('.register-form').classList.add('hidden');
    document.querySelector('.login-form').classList.remove('hidden');
});
