const { execSync } = require('child_process');

try {
  console.log('Testing drizzle-kit...');
  const result = execSync('npx drizzle-kit generate --verbose', { 
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log('Output:', result);
} catch (error) {
  console.log('Error:', error.message);
  console.log('Stdout:', error.stdout);
  console.log('Stderr:', error.stderr);
}