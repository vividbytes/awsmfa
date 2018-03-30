#!/usr/bin/env node

const execSync = require('child_process').execSync;
const fs = require('fs');

const token = process.argv[2];
const profile = process.argv[3];
const duration = 86400;

let creds;
let credentials;

const credentialsFile = `${process.env.HOME}/.aws/credentials`;

if (!token) {
    console.error('Error: no token provided');
    process.exit(2);
}

if (!profile) {
    console.error('Error: no profile provided');
    process.exit(2);
}

try {
    credentials = fs.readFileSync(credentialsFile, 'utf8');
} catch (e) {
    console.error("Error: couldn't open credentials file");
    console.error(e.message);
    process.exit(3);
}

const lines = credentials.split('\n');

const headerRegex = /\[(.*)\]/;
const optionRegex = /(.*)=(.*)/;

let currentProfile = '';
const config = lines.reduce((acc, line) => {
    const headerMatch = headerRegex.exec(line.trim());
    if (headerMatch) {
        currentProfile = headerMatch[1];
        acc[currentProfile] = {};
    } else {
        const optionMatch = optionRegex.exec(line.trim());
        if (optionMatch) {
            const key = optionMatch[1].trim();
            const value = optionMatch[2].trim();
            acc[currentProfile][key] = value;
        }
    }
    return acc;
}, {});

if (!config[profile]) {
    console.error(`Error: profile ${profile} not found in credentials file`);
    process.exit(4);
}

const mfaArn = config[profile].mfa_arn;

if (!mfaArn) {
    console.error(`Error: no mfa_arn defined for profile ${profile}`);
    process.exit(5);
}

try {
    const credString = execSync(
        `aws --profile ${profile} sts get-session-token \
             --serial-number ${mfaArn} \
             --token-code ${token} \
             --duration-seconds ${duration}`
    );

    creds = JSON.parse(credString).Credentials;
} catch (e) {
    console.error(e.message);
    process.exit(1);
}

config.default = {
    aws_access_key_id: creds.AccessKeyId,
    aws_secret_access_key: creds.SecretAccessKey,
    aws_session_token: creds.SessionToken
};

configString = Object.keys(config).reduce((acc, profile) => {
    acc += `

[${profile}]`;
    Object.keys(config[profile]).forEach(key => {
        acc += `
${key} = ${config[profile][key]}`;
    });
    return acc;
}, '');

fs.writeFileSync(credentialsFile, configString);
