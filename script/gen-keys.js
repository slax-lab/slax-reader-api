const crypto = require('crypto')

/**
 * 将 VAPID 密钥转换为 JWK 格式
 */
async function convertVAPIDToJWK() {
  try {
    // 1. VAPID 密钥
    const privateKeyBase64 = ''
    const publicKeyBase64 = ''

    // 2. 转换公钥格式 (跳过第一个字节，它是格式标识符)
    const publicKeyBuffer = Buffer.from(publicKeyBase64, 'base64url')
    const actualPublicKey = publicKeyBuffer.slice(1) // 移除第一个字节

    // 3. 提取 x 和 y 坐标
    const x = actualPublicKey.slice(0, 32) // 前32字节是 x 坐标
    const y = actualPublicKey.slice(32, 64) // 后32字节是 y 坐标

    // 4. 构造 JWK
    const jwk = {
      kty: 'EC',
      crv: 'P-256',
      d: privateKeyBase64, // 私钥
      x: x.toString('base64url'), // x 坐标
      y: y.toString('base64url') // y 坐标
    }

    return {
      jwk
    }
  } catch (error) {
    console.error('Error converting keys:', error)
    throw error
  }
}

/**
 * 生成密钥并输出
 */
async function generateKeys() {
  try {
    const result = await convertVAPIDToJWK()

    console.log('\nJWK format (保存这个到环境变量):')
    console.log(JSON.stringify(result.jwk))

    console.log('\n将以下内容添加到 .env 文件:')
    console.log(`JWK='${JSON.stringify(result.jwk)}'`)
  } catch (error) {
    console.error('Error generating keys:', error)
  }
}

// 运行生成函数
generateKeys()
