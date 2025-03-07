const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const migrationsPath = path.resolve(__dirname, '../migrations')

if (!fs.existsSync(migrationsPath)) {
  fs.mkdirSync(migrationsPath)
}

const getNextIndex = () => {
  const files = fs.readdirSync(migrationsPath)
  const indices = files.map(file => parseInt(file.split('_')[0])).filter(num => !isNaN(num))
  return indices.length > 0 ? Math.max(...indices) + 1 : 1
}

const askFileName = defaultIndex => {
  return new Promise(resolve => {
    const filePrefix = String(defaultIndex).padStart(5, '0')
    rl.question(`please input file name: ${filePrefix}_`, input => {
      const fileName = `${filePrefix}_${input.trim()}.sql`
      resolve(fileName)
    })
  })
}

const getDatabase = () => {
  const env = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8')
  const dbLine = env.split('\n').find(item => item.startsWith('DATABASE_URL'))
  if (!dbLine) {
    throw new Error('DATABASE_URL 未找到, 请检查.env文件')
  }
  return dbLine.split('=').pop().trim()
}

const main = async () => {
  const nextIndex = getNextIndex()
  const fileName = await askFileName(nextIndex)
  const outputPath = path.join(migrationsPath, fileName)

  console.log(`正在检测数据库...`)
  const db = getDatabase()
  console.log(`数据库: ${db}`)

  console.log(`正在生成 diff 文件到: ${outputPath}`)

  exec(`pnpm prisma migrate diff --from-url ${db} --to-schema-datamodel ./prisma/schema.prisma --script > ${outputPath}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`生成 diff 文件时出错: ${error.message}`)
      rl.close()
      return
    }

    if (stderr) {
      console.error(`stderr: ${stderr}`)
    }

    console.log('diff 文件生成成功，正在过滤需要忽略的表...')

    fs.readFile(outputPath, 'utf8', (err, data) => {
      if (err) {
        console.error(`读取文件时出错: ${err.message}`)
        rl.close()
        return
      }

      const filteredData = data
        .split('\n')
        .filter(line => !line.includes('slax_fts_'))
        .join('\n')

      fs.writeFile(outputPath, filteredData, 'utf8', writeErr => {
        if (writeErr) {
          console.error(`写入文件时出错: ${writeErr.message}`)
        } else {
          console.log(`过滤完成！文件已生成到: ${outputPath}`)
        }
        rl.close()
      })
    })
  })
}

main()
