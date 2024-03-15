document.addEventListener('DOMContentLoaded', function() {
    let form = document.getElementById('home');

    if (form) {
        let displayName = sessionStorage.getItem('display_name');
        if (displayName) {
            let nameInput = form.querySelector('#name');
            if (nameInput) {
                nameInput.value = displayName;
            }
        }

        form.addEventListener('submit', function(e) {
            e.preventDefault();

            let nameInput = form.querySelector('#name');
            let roomInput = form.querySelector('#room');

            if (nameInput && roomInput) {
                sessionStorage.setItem('display_name', nameInput.value);

                let inviteCode = roomInput.value.trim();
                if (!inviteCode) {
                    inviteCode = String(Math.floor(Math.random() * 10000));
                }

                // Redirect to the room with the generated or provided invite code
                window.location = `room.html?room=${inviteCode}`;
            } else {
                console.error('Form elements not found.');
            }
        });
    } else {
        console.error('Form element not found.');
    }
});