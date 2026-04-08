import { supabase, signInWithProvider, signOut, ensureHydrated } from '@/utils/auth';

const loadingSection = document.getElementById('loading-section')!;
const authSection = document.getElementById('auth-section')!;
const userSection = document.getElementById('user-section')!;
const userEmail = document.getElementById('user-email')!;
const signInGoogleBtn = document.getElementById('sign-in-google')!;
const signInGithubBtn = document.getElementById('sign-in-github')!;
const signOutBtn = document.getElementById('sign-out')!;

function showSection(section: 'loading' | 'auth' | 'user') {
  loadingSection.style.display = section === 'loading' ? 'block' : 'none';
  authSection.style.display = section === 'auth' ? 'block' : 'none';
  userSection.style.display = section === 'user' ? 'block' : 'none';
}

async function updateUI() {
  await ensureHydrated();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    userEmail.textContent = session.user.email ?? 'Unknown';
    showSection('user');
  } else {
    showSection('auth');
  }
}

function disableButtons(disabled: boolean) {
  signInGoogleBtn.toggleAttribute('disabled', disabled);
  signInGithubBtn.toggleAttribute('disabled', disabled);
}

signInGoogleBtn.addEventListener('click', async () => {
  disableButtons(true);
  try {
    await signInWithProvider('google');
    await updateUI();
  } catch (err) {
    console.error('[screenshotr] Google sign-in failed:', err);
    disableButtons(false);
  }
});

signInGithubBtn.addEventListener('click', async () => {
  disableButtons(true);
  try {
    await signInWithProvider('github');
    await updateUI();
  } catch (err) {
    console.error('[screenshotr] GitHub sign-in failed:', err);
    disableButtons(false);
  }
});

signOutBtn.addEventListener('click', async () => {
  try {
    await signOut();
    await updateUI();
  } catch (err) {
    console.error('[screenshotr] Sign-out failed:', err);
  }
});

updateUI();
