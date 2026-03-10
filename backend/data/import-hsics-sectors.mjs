import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * 从 HSICS / 港股行业分类导出的 CSV 生成静态板块映射：
 *
 * 使用步骤：
 * 1. 从恒生指数公司网站或 BigQuant 导出港股行业分类 CSV。
 * 2. 在表格工具中整理成至少包含以下两列，并导出为 UTF-8 CSV：
 *    - code   : 股票代码，例如 700、0700、388、00388 等
 *    - sector : 行业 / 三级子行业名称，例如 「银行」「应用软件」「餐饮服务」等
 * 3. 将整理后的文件保存为 backend/data/hsics.csv。
 * 4. 在项目根目录执行：npm run sectors:import
 *
 * 脚本会读取 backend/data/hsics.csv，规范化代码为 5 位（左侧补 0），
 * 再将细粒度行业名称归并为 10–12 个大板块，
 * 写入 backend/data/sectors.json，供服务端加载和前端筛选使用。
 */

// 将 HSICS 细分类名称（中文）归并到大板块
function mapToMajorSector(raw) {
  if (!raw) return '综合企业';
  const name = String(raw).trim();

  // 金融
  if (
    /银行|保险|证券|券商|金融|信托|资管|财富管理|保险经纪|再保险|金融服务/.test(name)
  ) {
    return '金融';
  }

  // 信息科技
  if (
    /软件|科技|互联网|資訊科技|信息科技|半导体|晶圆|芯片|电子设备|计算机|IT|云计算|数据中心|应用软件|系统软件/.test(
      name,
    )
  ) {
    return '信息科技';
  }

  // 地产建筑
  if (
    /地产|物业|房地产|物業|物业管理|建筑|建築|基建|建设|建材|工程承包/.test(name)
  ) {
    return '地产建筑';
  }

  // 公用事业
  if (/电力|水务|燃气供应|燃氣|公用事业|公用事業|自来水/.test(name)) {
    return '公用事业';
  }

  // 电信
  if (/电讯|電訊|电信|通信服务|通訊服務/.test(name)) {
    return '电信';
  }

  // 医疗保健
  if (/医药|藥品|制药|生物科技|医疗|醫療|医疗设备|醫療設備|医疗保健|醫療保健|医院|醫院/.test(name)) {
    return '医疗保健';
  }

  // 原材料
  if (/材料|金属|鋼鐵|钢铁|矿业|礦業|资源|資源|化工|水泥|采矿|採礦|有色金属/.test(name)) {
    return '原材料';
  }

  // 能源
  if (/能源|石油|天然气|天然氣|油气|油氣|煤炭|煤/.test(name)) {
    return '能源';
  }

  // 工业
  if (/工业|工業|机械|機械|设备|設備|运输|運輸|航空|铁路|鐵路|物流|工程机械|機電/.test(name)) {
    return '工业';
  }

  // 可选消费
  if (
    /汽车|車輛|家电|家電|餐饮|餐飲|酒店|旅游|旅遊|娱乐|娛樂|媒体|媒體|出版|服饰|服飾|奢侈品|博彩|教育|影院|影視|互联网零售|在线零售/.test(
      name,
    )
  ) {
    return '可选消费';
  }

  // 必选消费
  if (/食品|饮料|飲料|超市|便利店|日用品|农产品|農產品|粮油|糧油|烟草|菸草/.test(name)) {
    return '必选消费';
  }

  // 默认归入综合企业（或未分类）
  if (/综合|綜合/.test(name)) {
    return '综合企业';
  }

  return '综合企业';
}

async function main() {
  const root = process.cwd();
  const inputPath = path.resolve(root, 'backend/data/hsics.csv');
  const outputPath = path.resolve(root, 'backend/data/sectors.json');

  let csv;
  try {
    csv = await fs.readFile(inputPath, 'utf8');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`无法读取 ${inputPath}，请确认文件已存在（从官方 HSICS 导出并命名为 hsics.csv）。`);
    throw err;
  }

  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length <= 1) {
    throw new Error('CSV 内容为空或只有表头，请检查 backend/data/hsics.csv。');
  }

  const headerLine = lines[0];
  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());

  const codeIndex = headers.findIndex((h) => h === 'code');
  const sectorIndex = headers.findIndex((h) => h === 'sector');

  if (codeIndex === -1 || sectorIndex === -1) {
    throw new Error('CSV 需至少包含列名为 code 和 sector 的两列，请检查表头。');
  }

  const mapping = {};

  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(',');
    if (parts.length <= Math.max(codeIndex, sectorIndex)) continue;

    let code = parts[codeIndex].trim();
    const sectorRaw = parts[sectorIndex].trim();
    if (!code || !sectorRaw) continue;

    // 去掉非数字字符，只保留数值部分
    code = code.replace(/[^\d]/g, '');
    if (!code) continue;

    // 统一为 5 位代码，例如 700 -> 00700
    const normalized = code.padStart(5, '0');
    const majorSector = mapToMajorSector(sectorRaw);
    mapping[normalized] = majorSector;
  }

  await fs.writeFile(outputPath, `${JSON.stringify(mapping, null, 2)}\n`, 'utf8');

  // eslint-disable-next-line no-console
  console.log(`已生成 ${Object.keys(mapping).length} 条代码→板块映射到 ${outputPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

