---
name: storage
description: Storage management - S3, local disks, mount points
version: 1.0.0
---

# Storage Skill

Manage storage, S3 buckets, and disk usage.

## Tools

[[tool]]
name: storage_disks
description: List disk usage
params: []

[[tool]]
name: storage_mounts
description: List mount points
params: []

[[tool]]
name: storage_s3_list
description: List S3 buckets/objects
params:
  - name: bucket
    type: string
    required: false
    description: Bucket name
  - name: prefix
    type: string
    required: false
    description: Object prefix

[[tool]]
name: storage_s3_upload
description: Upload to S3
params:
  - name: bucket
    type: string
    required: true
    description: Bucket name
  - name: file
    type: string
    required: true
    description: File to upload
  - name: key
    type: string
    required: false
    description: Object key

[[tool]]
name: storage_s3_download
description: Download from S3
params:
  - name: bucket
    type: string
    required: true
    description: Bucket name
  - name: key
    type: string
    required: true
    description: Object key
  - name: destination
    type: string
    required: true
    description: Destination path

## Script

async function storage_disks() {
  const { stdout } = await exec('df -h | grep -v tmpfs');
  const lines = stdout.trim().split('\n').map(l => l.split(/\s+/));
  
  const disks = lines.slice(1).map(l => ({
    filesystem: l[0],
    size: l[1],
    used: l[2],
    available: l[3],
    use_percent: l[4],
    mounted: l[5]
  }));
  
  return { disks };
}

async function storage_mounts() {
  const { stdout } = await exec('mount | grep -v tmpfs');
  
  const mounts = stdout.trim().split('\n').map(l => {
    const parts = l.split(' on ');
    return { device: parts[0], point: parts[1]?.split(' ')[0] };
  });
  
  return { mounts };
}

async function storage_s3_list({ bucket = '', prefix = '' }) {
  const { stdout } = await exec(\`aws s3 ls s3://\${bucket}/\${prefix} 2>/dev/null || echo "Configure AWS credentials"\`);
  
  return {
    bucket,
    prefix,
    objects: stdout.trim().split('\n').filter(Boolean)
  };
}

async function storage_s3_upload({ bucket, file, key = '' }) {
  const keyName = key || file.split('/').pop();
  const { stdout } = await exec(\`aws s3 cp "\${file}" "s3://\${bucket}/\${keyName}" 2>&1\`);
  
  return {
    bucket,
    file,
    key: keyName,
    status: stdout.includes('upload') ? 'success' : 'failed'
  };
}

async function storage_s3_download({ bucket, key, destination }) {
  const { stdout } = await exec(\`aws s3 cp "s3://\${bucket}/\${key}" "\${destination}" 2>&1\`);
  
  return {
    bucket,
    key,
    destination,
    status: stdout.includes('download') ? 'success' : 'failed'
  };
}
