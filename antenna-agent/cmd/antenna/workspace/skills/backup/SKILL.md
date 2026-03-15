---
name: backup
description: Backup and restore files, databases, and systems
version: 1.0.0
---

# Backup Skill

Backup and restore files, databases, and system snapshots.

## Tools

[[tool]]
name: backup_files
description: Backup files/directories
params:
  - name: source
    type: string
    required: true
    description: Source path
  - name: destination
    type: string
    required: true
    description: Backup destination
  - name: compress
    type: boolean
    required: false
    description: Compress backup

[[tool]]
name: backup_list
description: List available backups
params:
  - name: path
    type: string
    required: false
    description: Backup directory

[[tool]]
name: backup_restore
description: Restore from backup
params:
  - name: backup
    type: string
    required: true
    description: Backup file path
  - name: destination
    type: string
    required: true
    description: Restore destination

[[tool]]
name: backup_mysql
description: Backup MySQL/MariaDB
params:
  - name: database
    type: string
    required: true
    description: Database name
  - name: destination
    type: string
    required: true
    description: Backup file

[[tool]]
name: backup_postgres
description: Backup PostgreSQL
params:
  - name: database
    type: string
    required: true
    description: Database name
  - name: destination
    type: string
    required: true
    description: Backup file

## Script

async function backup_files({ source, destination, compress = true }) {
  const ext = compress ? '.tar.gz' : '';
  const cmd = compress 
    ? \`tar czf "\${destination}\${ext}" -C "\${source}" .\`
    : \`cp -r "\${source}" "\${destination}"\`;
  
  const { stdout, stderr } = await exec(\`\${cmd} 2>&1\`);
  
  return {
    source,
    destination: destination + ext,
    compressed: compress,
    status: stderr ? 'failed' : 'success'
  };
}

function backup_list({ path = '~/backups' }) {
  const expanded = path.replace('~', process.env.HOME || '~');
  return {
    path: expanded,
    note: 'List backup files in directory',
    backups: []
  };
}

async function backup_restore({ backup, destination }) {
  const isGzip = backup.endsWith('.gz');
  const cmd = isGzip 
    ? \`tar xzf "\${backup}" -C "\${destination}"\`
    : \`cp -r "\${backup}" "\${destination}"\`;
  
  return {
    backup,
    destination,
    note: 'Restore from backup file'
  };
}

async function backup_mysql({ database, destination }) {
  const { stdout } = await exec(\`mysqldump \${database} > "\${destination}" 2>&1\`);
  return {
    database,
    destination,
    type: 'mysql',
    note: 'Requires mysqldump installed'
  };
}

async function backup_postgres({ database, destination }) {
  const { stdout } = await exec(\`pg_dump \${database} > "\${destination}" 2>&1\`);
  return {
    database,
    destination,
    type: 'postgresql',
    note: 'Requires pg_dump installed'
  };
}
