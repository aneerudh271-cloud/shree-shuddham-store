import bcrypt from 'bcryptjs';

if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
  console.error('Run this interactively in a terminal so the password is not echoed or passed in command history.');
  process.exit(1);
}

const chunks = [];
const stdin = process.stdin;
const stdout = process.stdout;
stdout.write('Initial admin password (input hidden): ');
stdin.setRawMode(true);
stdin.resume();
stdin.setEncoding('utf8');

stdin.on('data', (key) => {
  if (key === '\u0003') {
    stdout.write('\nCancelled.\n');
    process.exit(130);
  }
  if (key === '\r' || key === '\n') {
    stdin.setRawMode(false);
    stdin.pause();
    const password = chunks.join('');
    stdout.write('\n');
    if (password.length < 12) {
      console.error('Choose a password with at least 12 characters.');
      process.exit(1);
    }
    stdout.write(`${bcrypt.hashSync(password, 12)}\n`);
    return;
  }
  if (key === '\u007f' || key === '\b') {
    chunks.pop();
    return;
  }
  if (key.length === 1 && key >= ' ' && key !== '\u007f') chunks.push(key);
});
