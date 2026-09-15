// Module-download failures happen before React's error boundary can mount.
import('./main.jsx').catch(error => {
    console.error('Store startup failed:', error);
    const root = document.getElementById('root');
    const message = document.createElement('p');
    message.textContent = 'The store could not load. Please reload the page or try again shortly.';
    message.setAttribute('role', 'alert');
    const reload = document.createElement('button');
    reload.textContent = 'Reload page';
    reload.addEventListener('click', () => window.location.reload());
    root.replaceChildren(message, reload);
});
