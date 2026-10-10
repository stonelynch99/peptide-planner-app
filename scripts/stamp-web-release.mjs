import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();const publishedAt=Number(execFileSync('git',['show','-s','--format=%ct','HEAD'],{encoding:'utf8'}).trim())*1000;
if(!/^[a-f0-9]{40}$/.test(sha)||!Number.isSafeInteger(publishedAt))throw Error('RELEASE_ID_REQUIRED');
const file='dist/index.html',html=fs.readFileSync(file,'utf8');if(!html.includes('</head>')||html.includes('name="ezpep-release"'))throw Error('EXPORT_METADATA_CONFLICT');
fs.writeFileSync(file,html.replace('</head>',`<meta name="ezpep-release" content="${sha}"><meta name="ezpep-release-time" content="${publishedAt}"></head>`));fs.writeFileSync('dist/release.json',JSON.stringify({sha,publishedAt}));
