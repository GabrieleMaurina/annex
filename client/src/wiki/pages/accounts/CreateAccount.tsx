import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function CreateAccount() {
  return (
    <>
      <WikiSection id="signup" title="Signing up">
        <p>Open the menu, choose Log in, then Create account. You enter:</p>
        <WikiTable
          head={['Field', 'Rule']}
          rows={[
            [
              'Username',
              '3 to 10 letters or digits. Unique, no profanity, and it can never be changed.',
            ],
            [
              'Email',
              'Used to confirm the account and recover the password. Never changeable. One account per mailbox: dots and +tags in addresses are ignored.',
            ],
            [
              'Password',
              '8 to 128 characters with an uppercase letter, a lowercase letter and a digit.',
            ],
            ['Confirm password', 'Must match.'],
          ]}
        />
        <p>
          Your country is guessed from your time zone and can be changed on the{' '}
          <WikiLink to="accounts/account-page" />.
        </p>
      </WikiSection>
      <WikiSection id="confirm" title="Confirming your email">
        <p>
          You receive an email with a link. Open it to confirm the address.
          Confirming does not log you in. Return to the login page and sign in.
          Until the email is confirmed, logging in is refused and a fresh
          confirmation email is sent.
        </p>
      </WikiSection>
      <WikiSection id="login" title="Logging in and out">
        <ul>
          <li>
            You log in with your email and password. Your username is not used
            to log in.
          </li>
          <li>
            Tick <strong>Stay logged in</strong> to remember the device. Without
            it the session ends when the browser closes.
          </li>
          <li>
            Logins expire after a long period of inactivity, so you may need to
            sign in again.
          </li>
          <li>Too many wrong passwords in a row pause login for a while.</li>
          <li>
            You cannot log in or out while you hold a seat in a running game.
            Return to it and surrender or finish it first.
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="reset" title="Forgot your password">
        <p>
          After a failed login the page offers a reset. Enter your email and
          open the link you receive. Setting a new password signs out every
          device.
        </p>
      </WikiSection>
      <SeeAlso
        pages={['accounts/guests-and-accounts', 'accounts/account-page']}
      />
    </>
  );
}

export default CreateAccount;
