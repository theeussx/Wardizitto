const axios = require('axios');
require('dotenv').config();
const FormData = require('form-data');

async function uploadFileToVirusTotal(fileUrl) {
    try {
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const form = new FormData();
        form.append('file', response.data, { filename: 'upload' });

        const upload = await axios.post('https://www.virustotal.com/api/v3/files', form, {
            headers: {
                'x-apikey': process.env.VIRUSTOTAL_API_KEY,
                ...form.getHeaders()
            }
        });

        return upload.data.data;
    } catch (error) {
        console.error('Erro ao enviar arquivo:', error);
        return null;
    }
}

async function analyzeUrl(url) {
    try {
        const encodedUrl = Buffer.from(url).toString('base64').replace(/=+$/, '');
        const res = await axios.get(`https://www.virustotal.com/api/v3/urls/${encodedUrl}`, {
            headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY }
        });
        return res.data.data;
    } catch (error) {
        console.error('Erro ao analisar URL:', error);
        return null;
    }
}

async function analyzeIP(ip) {
    try {
        const res = await axios.get(`https://www.virustotal.com/api/v3/ip_addresses/${ip}`, {
            headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY }
        });
        return res.data.data;
    } catch (error) {
        console.error('Erro ao analisar IP:', error);
        return null;
    }
}

async function analyzeDomain(domain) {
    try {
        const res = await axios.get(`https://www.virustotal.com/api/v3/domains/${domain}`, {
            headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY }
        });
        return res.data.data;
    } catch (error) {
        console.error('Erro ao analisar domínio:', error);
        return null;
    }
}

async function fetchAnalysis(id) {
    try {
        const res = await axios.get(`https://www.virustotal.com/api/v3/analyses/${id}`, {
            headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY }
        });

        if (res.data.data.attributes.status === 'completed') {
            return res.data.data;
        } else {
            await new Promise(resolve => setTimeout(resolve, 5000)); // espera 5s
            return fetchAnalysis(id); // recursivo até concluir
        }
    } catch (error) {
        console.error('Erro ao buscar análise:', error);
        return null;
    }
}

module.exports = { uploadFileToVirusTotal, analyzeUrl, analyzeIP, analyzeDomain, fetchAnalysis };