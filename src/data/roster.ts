import {
  CHECKED_AT,
  CHIEFS,
  SKILL_KEYS,
  type Access,
  type Cap,
  type LiveStaff,
  type Meter,
  type Rank,
  type SkillKey,
  type Staff,
  type StaffOver,
} from "@/lib/types";

const CAP: Record<string, Cap> = { y: "yes", p: "partial", n: "no", u: "unverified" };

const NOTES = {
  mix: "Có website và API tách nhau. Website miễn phí không có nghĩa API miễn phí. Số token hoặc số lượt chính thức: chưa xác minh.",
  web: "Chủ yếu dùng bằng tài khoản website. Không kết luận là API miễn phí. Hạn mức token: chưa xác minh.",
  paid: "Kênh chính tính phí hoặc không còn bậc miễn phí ổn định đã kiểm chứng. Không ghi số token.",
  oss: "Mã nguồn mở. Tự chạy thì không phát sinh cước nhà cung cấp. Giấy phép nằm tại nguồn.",
  trial: "Lệch về bản dùng thử hoặc trả phí. Không khẳng định còn hạn mức miễn phí thường xuyên. Số liệu: chưa xác minh.",
  local: "Chạy trên máy người dùng. Trần sử dụng là phần cứng và giấy phép, không phải hạn mức token cloud đã công bố.",
  lib: "Thư viện hoặc khung phần mềm, không phải tài khoản chatbot. Không có hạn mức token của nhà cung cấp.",
  freeapi:
    "Tài liệu công khai có bậc API không mất phí hoặc model giá 0, nhưng con số hạn mức hiện hành chưa xác minh trong phiên này.",
} as const;

type NoteKey = keyof typeof NOTES;

type Row = [
  id: string,
  name: string,
  developer: string,
  country: string,
  website: string,
  groups: string,
  department: string,
  rank: Rank,
  title: string,
  access: Access,
  meter: Meter,
  note: NoteKey,
  summary: string,
  strength: string,
  weakness: string,
  caps: string,
  skill: string,
  budget: number,
];

function skillsOf(spec: string, id: string): Record<SkillKey, number> {
  const base = Object.fromEntries(SKILL_KEYS.map((k) => [k, 8])) as Record<SkillKey, number>;
  for (const part of spec.split(",").filter(Boolean)) {
    const key = part[0] as SkillKey;
    const n = Number(part.slice(1));
    if (!SKILL_KEYS.includes(key) || !Number.isFinite(n) || n < 0 || n > 100) {
      throw new Error(`Điểm kỹ năng không hợp lệ: ${id} ${part}`);
    }
    base[key] = n;
  }
  return base;
}

function capsOf(spec: string, id: string) {
  if (!/^([ypnu]{5})$/.test(spec)) throw new Error(`Năng lực không hợp lệ: ${id}`);
  const c = spec.split("").map((ch) => CAP[ch]);
  return {
    api: c[0]!,
    automation: c[1]!,
    fileEdit: c[2]!,
    multiFile: c[3]!,
    tools: c[4]!,
  };
}

const ROWS: Row[] = [
  ["chatgpt", "ChatGPT", "OpenAI", "Hoa Kỳ", "https://chatgpt.com", "AI tổng quát|Viết nội dung|Văn phòng", "Điều hành", "ceo", "Giám đốc điều hành", "mixed", "account", "mix", "Mô hình hội thoại đa việc của OpenAI, kiêm vai CEO trong sơ đồ này.", "Tổng hợp, viết và đóng gói báo cáo rõ cho người ra quyết định.", "Có thể trả lời chắc trên việc chưa kiểm chứng. API tính phí, hạn mức web không ổn định công khai.", "ypyyp", "P76,L70,K82,N80,W94,D88,H68,V36,A28,T72,M60,G74,E55,S46,O93,U70", 90],
  ["claude", "Claude", "Anthropic", "Hoa Kỳ", "https://claude.ai", "AI tổng quát|Lập trình|Viết nội dung", "Kiến trúc", "director", "Giám đốc Kiến trúc và Phân tích", "mixed", "account", "mix", "Mô hình mạnh về văn bản dài, phân tích và sửa lập luận.", "Đọc ngữ cảnh dài, tách kiến trúc và viết kỹ thuật cẩn thận.", "Không phải công cụ hình hoặc video. API tính phí.", "ypyyp", "P88,L84,K96,N86,W91,D84,H24,V12,A10,T70,M58,G80,E62,S60,O72,U64", 88],
  ["gemini", "Gemini", "Google", "Hoa Kỳ", "https://gemini.google.com", "AI tổng quát|Thiết kế|Nghiên cứu", "Thiết kế", "director", "Giám đốc Đa phương tiện", "mixed", "account", "mix", "Mô hình Google xử lý chữ, ảnh và tác vụ gắn hệ sinh thái Google.", "Nhìn được tài liệu, ảnh và bài toán giao diện trong một lượt.", "Chất lượng lệch giữa các bề mặt sản phẩm. Hạn mức AI Studio chưa xác minh.", "ypyyp", "P80,L74,K78,N85,W84,D86,H76,V72,A40,T78,M64,G70,E58,S44,O80,U88", 84],
  ["grok", "Grok", "xAI", "Hoa Kỳ", "https://grok.com", "AI tổng quát|Nghiên cứu|Viết nội dung", "Nghiên cứu", "director", "Giám đốc Nghiên cứu và Phản biện", "mixed", "account", "mix", "Mô hình xAI dùng để đối chiếu, phản biện và cập nhật thông tin.", "Đặt câu hỏi ngược và chỉ ra lỗ hổng của một phương án.", "Không phải công cụ sửa kho mã nhiều file. API xAI tính phí.", "ypppp", "P74,L68,K76,N94,W86,D80,H40,V24,A18,T66,M48,G62,E40,S42,O70,U60", 80],
  ["deepseek", "DeepSeek", "DeepSeek", "Trung Quốc", "https://chat.deepseek.com", "AI tổng quát|Lập trình", "Lập trình", "director", "Giám đốc Kỹ thuật", "mixed", "account", "mix", "Mô hình mạnh về lập trình và suy luận kỹ thuật, có bản chat và API.", "Tìm lỗi logic và viết mã với chi phí API thường thấp hơn nhóm dẫn đầu.", "Chính sách dữ liệu và độ sẵn sàng cần Chủ tịch tự xét. Hạn mức miễn phí chưa xác minh.", "ypyyp", "P92,L94,K86,N72,W70,D78,H20,V10,A8,T80,M55,G68,E64,S58,O40,U48", 86],
  ["perplexity", "Perplexity", "Perplexity", "Hoa Kỳ", "https://www.perplexity.ai", "Nghiên cứu|AI tổng quát", "AI tổng quát", "director", "Giám đốc Tình báo nguồn", "mixed", "account", "mix", "Công cụ trả lời kèm trích nguồn trên web.", "Gắn câu trả lời với đường dẫn nguồn, hợp việc kiểm chứng nhanh.", "Không sửa kho mã. Nguồn web có thể nông nếu không mở tiếp.", "yppnp", "P40,L30,K48,N92,W78,D70,H10,V8,A8,T60,M30,G40,E24,S30,O55,U36", 82],
  ["qwen", "Qwen", "Alibaba", "Trung Quốc", "https://chat.qwen.ai", "AI tổng quát|Lập trình|Dịch thuật", "Lập trình", "specialist", "Chuyên viên lập trình", "mixed", "account", "mix", "Dòng mô hình Alibaba cho chat, mã và đa ngôn ngữ.", "Mạnh tiếng Trung và các tác vụ mã thông dụng.", "Hệ sản phẩm đổi tên bề mặt thường xuyên. Hạn mức chưa xác minh.", "ypppp", "P86,L82,K72,N64,W68,D84,H30,T62,G60,U40", 78],
  ["mistral", "Mistral", "Mistral AI", "Pháp", "https://chat.mistral.ai", "AI tổng quát|Lập trình|Hạ tầng", "Lập trình", "specialist", "Chuyên viên mô hình mở", "mixed", "account", "mix", "Nhà phát triển châu Âu có cả model mở và API thương mại.", "Có trọng số mở để tự triển khai, giảm khóa nhà cung cấp.", "Bản chat công cộng không thay IDE nhiều file.", "yppnp", "P78,L72,K70,N60,W66,D64,G58,T50", 74],
  ["kimi", "Kimi", "Moonshot AI", "Trung Quốc", "https://kimi.moonshot.cn", "AI tổng quát|Nghiên cứu|Viết nội dung", "Nghiên cứu", "specialist", "Chuyên viên đọc tài liệu dài", "web", "account", "web", "Trợ lý đọc ngữ cảnh rất dài của Moonshot.", "Nuốt được tài liệu dài để tóm tắt và hỏi lại.", "API và hạn mức công khai chưa xác minh trong phiên này.", "upppp", "N84,W80,D76,K60,P48,O62", 70],
  ["cohere", "Cohere", "Cohere", "Canada", "https://cohere.com", "AI tổng quát|Lập trình|Hạ tầng", "AI tổng quát", "specialist", "Chuyên viên mô hình doanh nghiệp", "api-paid", "account", "paid", "Nền tảng mô hình hướng doanh nghiệp và tìm kiếm ngữ nghĩa.", "API rõ cho nhúng và sinh văn bản trong sản phẩm.", "Không phải công cụ làm việc miễn phí hàng ngày cho Chủ tịch.", "ypnnp", "P70,W72,N68,T64,K60,G50", 60],
  ["llama", "Llama", "Meta", "Hoa Kỳ", "https://www.llama.com", "AI tổng quát|Hạ tầng|Lập trình", "Hạ tầng", "specialist", "Chuyên viên mô hình mở", "oss", "library", "oss", "Họ mô hình mở của Meta, chạy qua công cụ khác chứ không phải một website chat duy nhất.", "Tự host được, dùng khi không muốn gửi dữ liệu ra ngoài.", "Chất lượng phụ thuộc bản và máy chạy. Không có hạn mức tài khoản.", "yppnp", "P72,L66,K64,W60,N58,G54", 88],
  ["pi", "Pi", "Inflection", "Hoa Kỳ", "https://pi.ai", "AI tổng quát|Viết nội dung", "AI tổng quát", "specialist", "Chuyên viên hội thoại", "web", "account", "web", "Trợ lý hội thoại thiên về trao đổi tự nhiên.", "Giọng nói chuyện dễ dùng cho nháp ý tưởng.", "Không phải công cụ mã, dữ liệu hay tác tử kho mã.", "upnnp", "W74,O68,N52,D50", 64],
  ["copilot-web", "Microsoft Copilot", "Microsoft", "Hoa Kỳ", "https://copilot.microsoft.com", "AI tổng quát|Văn phòng|Viết nội dung", "Văn phòng", "specialist", "Chuyên viên trợ lý văn phòng", "mixed", "account", "mix", "Copilot trên web và sản phẩm Microsoft, khác với GitHub Copilot.", "Nằm sẵn trong thói quen văn phòng và tìm kiếm.", "Dễ nhầm với GitHub Copilot. API không phải hàng miễn phí.", "yppnp", "W78,O86,N70,D66,T48,U40", 76],
  ["poe", "Poe", "Quora", "Hoa Kỳ", "https://poe.com", "AI tổng quát|Viết nội dung", "AI tổng quát", "specialist", "Chuyên viên cửa nhiều mô hình", "mixed", "account", "mix", "Cửa gọi nhiều mô hình qua một tài khoản.", "Đổi model nhanh khi một bên tắc, hợp vai dự phòng hội thoại.", "Không sửa kho mã. Hạn mức điểm của Poe chưa xác minh.", "ypnnp", "W70,N64,D60,P40,O50", 68],
  ["copilot", "GitHub Copilot", "GitHub", "Hoa Kỳ", "https://github.com/features/copilot", "Lập trình|Coding Agent|Văn phòng", "Coding Agent", "lead", "Trưởng phòng Trợ lý lập trình", "mixed", "account", "mix", "Trợ lý mã trong editor của GitHub và Microsoft.", "Gợi ý ngay trong IDE và có tác nhân trên một số bề mặt.", "Bản đầy đủ tính phí. Không thay quy trình kiểm thử.", "pyyyp", "P88,L80,K66,U70,G72,E60,M50", 72],
  ["codex", "Codex", "OpenAI", "Hoa Kỳ", "https://openai.com/codex", "Lập trình|Coding Agent", "Coding Agent", "lead", "Trưởng phòng Thực thi mã", "api-paid", "account", "paid", "Tác nhân lập trình của OpenAI, giao việc qua kho mã.", "Sửa việc được mô tả rõ và chạy trong môi trường tách.", "Tính phí. Cần kho và quyền rõ, không phải chat miễn phí.", "yyyyy", "P92,L97,K80,N48,W50,D40,H8,V6,A6,T44,M50,G78,E70,S52,O30,U40", 77],
  ["cursor", "Cursor", "Anysphere", "Hoa Kỳ", "https://cursor.com", "Lập trình|Coding Agent|Thiết kế", "Coding Agent", "lead", "Trưởng phòng IDE Agent", "trial", "account", "trial", "IDE có tác nhân đọc và sửa nhiều file.", "Hiểu cả kho, sửa nhiều file và chạy lệnh trong dự án.", "Bản mạnh tính phí. Ngân sách vận hành nội bộ đang để thấp để thử chuyển giao.", "pyyyy", "P95,L92,K78,N50,W48,D36,H12,V8,A6,T40,M60,G88,E66,S50,O36,U74", 16],
  ["windsurf", "Windsurf", "Codeium", "Hoa Kỳ", "https://windsurf.com", "Lập trình|Coding Agent", "Coding Agent", "specialist", "Chuyên viên IDE Agent", "trial", "account", "trial", "IDE tác nhân, cùng lớp với Cursor.", "Sửa kho và giữ ngữ cảnh dự án.", "Đổi chủ và tên sản phẩm khá nhanh. Hạn mức chưa xác minh.", "pyyyy", "P86,L84,K68,G80,U60,E58,M52", 74],
  ["cline", "Cline", "Cline", "Chưa xác minh", "https://cline.bot", "Coding Agent|Lập trình|AI Agent", "Coding Agent", "specialist", "Chuyên viên tác nhân trong editor", "oss", "library", "oss", "Tiện ích editor mã nguồn mở điều khiển tệp và lệnh.", "Chủ tịch thấy từng bước công cụ trước khi chạy.", "Cần tự cấu hình model và khóa. Không kèm hạn mức miễn phí của riêng nó.", "nyyyy", "P84,L82,K66,G90,E60,M58,S44", 80],
  ["roo", "Roo Code", "Roo Code", "Chưa xác minh", "https://roocode.com", "Coding Agent|Lập trình", "Coding Agent", "specialist", "Chuyên viên tác nhân mã", "oss", "library", "oss", "Nhánh tác nhân mã nguồn mở trong editor, cùng họ với Cline.", "Tùy biến chế độ làm việc và vai trong kho mã.", "Chất lượng bám model bên dưới. Dự án cộng đồng đổi nhanh.", "nyyyy", "P82,L80,G84,E56,M54,K60", 76],
  ["aider", "Aider", "Paul Gauthier", "Chưa xác minh", "https://aider.chat", "Coding Agent|Lập trình", "Coding Agent", "specialist", "Chuyên viên sửa kho bằng git", "oss", "library", "oss", "Tác nhân dòng lệnh sửa kho và tạo commit.", "Làm việc theo git, hợp sửa có phạm vi và để lại lịch sử.", "Cần model API bên dưới, thường tính phí. Không có giao diện đồ họa.", "nyyyy", "P90,L88,K70,N36,W30,D28,H6,V4,A4,T30,M48,G72,E60,S40,O20,U34", 90],
  ["continue", "Continue", "Continue", "Hoa Kỳ", "https://www.continue.dev", "Coding Agent|Lập trình|Hạ tầng", "Coding Agent", "specialist", "Chuyên viên trợ lý editor mở", "oss", "library", "oss", "Lớp trợ lý mã nguồn mở nối nhiều model, kể cả model local.", "Đổi model mà không khóa một nhà cung cấp.", "Trải nghiệm phụ thuộc model gắn vào.", "nyyyy", "P80,L76,G70,K62,M60,U48", 84],
  ["replit", "Replit", "Replit", "Hoa Kỳ", "https://replit.com", "Coding Agent|Lập trình|Hạ tầng", "Coding Agent", "specialist", "Chuyên viên môi trường lập trình đám mây", "mixed", "account", "mix", "IDE trên web có tác nhân dựng ứng dụng.", "Có môi trường chạy sẵn, hợp bản thử nhanh.", "Bản Agent tính phí. Khó ôm kho lớn đã có từ trước.", "pyyyp", "P78,L70,G74,U72,M58,E50", 62],
  ["bolt", "Bolt", "StackBlitz", "Hoa Kỳ", "https://bolt.new", "Coding Agent|Thiết kế|Lập trình", "Coding Agent", "specialist", "Chuyên viên dựng ứng dụng nhanh", "trial", "account", "trial", "Sinh ứng dụng web ngay trên trình duyệt.", "Ra bản chạy rất nhanh từ một câu mô tả.", "Dễ phình phạm vi. Token dùng thử chưa xác minh.", "pyyyp", "P76,U84,G70,K58,E40,W48", 58],
  ["lovable", "Lovable", "Lovable", "Thụy Điển", "https://lovable.dev", "Coding Agent|Thiết kế", "Thiết kế", "specialist", "Chuyên viên dựng sản phẩm", "trial", "account", "trial", "Sinh ứng dụng có giao diện từ mô tả sản phẩm.", "Ra được luồng màn hình và dữ liệu mẫu nhanh.", "Bản trả phí mới đủ việc lớn. Khó kiểm soát kiến trúc sâu.", "pyyyp", "U86,P74,W60,G66,K56,E36", 60],
  ["v0", "v0", "Vercel", "Hoa Kỳ", "https://v0.dev", "Thiết kế|Lập trình|Coding Agent", "Thiết kế", "lead", "Trưởng phòng Giao diện sinh mã", "mixed", "account", "mix", "Sinh giao diện React từ mô tả, gắn hệ Vercel.", "Ra component nhìn được và sửa bằng hội thoại.", "Thiên về lớp giao diện, không ôm backend phức tạp.", "pyyyp", "U94,P80,W58,K60,H40,G54", 70],
  ["devin", "Devin", "Cognition", "Hoa Kỳ", "https://devin.ai", "Coding Agent|Lập trình|AI Agent", "Coding Agent", "specialist", "Chuyên viên kỹ sư tác nhân", "api-paid", "account", "paid", "Kỹ sư phần mềm dạng tác nhân, làm việc trên kho và trình duyệt.", "Nhận việc dài và tự dùng công cụ.", "Giá cao, không có bậc miễn phí đã xác minh.", "yyyyy", "P86,L82,G88,K70,E64,M60,S46", 40],
  ["jules", "Jules", "Google", "Hoa Kỳ", "https://jules.google", "Coding Agent|Lập trình", "Coding Agent", "specialist", "Chuyên viên tác nhân kho mã", "trial", "account", "trial", "Tác nhân của Google làm việc trên kho GitHub.", "Gắn sẵn với quy trình pull request.", "Độ phủ và hạn mức chưa xác minh.", "pyyyp", "P82,L78,G80,E60,K64", 55],
  ["cody", "Cody", "Sourcegraph", "Hoa Kỳ", "https://sourcegraph.com/cody", "Lập trình|Coding Agent|Nghiên cứu", "Coding Agent", "specialist", "Chuyên viên đọc kho lớn", "mixed", "account", "mix", "Trợ lý mã có tìm kiếm trên cả kho.", "Tìm chỗ định nghĩa và chỗ gọi trong kho lớn.", "Gói doanh nghiệp tính phí. Không thay người kiểm thử.", "pyyyp", "P80,L76,K74,N60,G64,E48", 58],
  ["coderabbit", "CodeRabbit", "CodeRabbit", "Hoa Kỳ", "https://coderabbit.ai", "Kiểm thử|Lập trình", "Kiểm thử", "specialist", "Chuyên viên duyệt pull request", "mixed", "account", "mix", "Góp ý tự động trên pull request.", "Bắt lỗi và chỗ thiếu test lúc duyệt mã.", "Không viết tính năng mới. Hạn mức kho miễn phí chưa xác minh.", "ypyy n".replace(" ", ""), "E78,P72,L80,S60,K58,W50", 66],
  ["midjourney", "Midjourney", "Midjourney", "Hoa Kỳ", "https://www.midjourney.com", "Hình ảnh|Thiết kế", "Hình ảnh", "lead", "Trưởng phòng Hình ảnh", "trial", "account", "trial", "Công cụ tạo ảnh nghệ thuật bằng prompt.", "Chất lượng hình thẩm mỹ cao, hợp concept.", "Không còn là công cụ miễn phí mặc định. Chữ trên ảnh yếu.", "upnnp", "H96,U40,W36,V20", 70],
  ["flux", "Flux", "Black Forest Labs", "Đức", "https://bfl.ai", "Hình ảnh|Hạ tầng", "Hình ảnh", "specialist", "Chuyên viên tạo ảnh", "mixed", "account", "mix", "Họ mô hình ảnh, có bản mở và API.", "Ảnh sắc, có đường tự host để khỏi khóa một cloud.", "API chính thức tính phí. Hạn mức bản mở phụ thuộc máy.", "yppnp", "H93,U36,P30,M28", 80],
  ["sd", "Stable Diffusion", "Stability AI", "Anh", "https://stability.ai", "Hình ảnh|Hạ tầng", "Hình ảnh", "specialist", "Chuyên viên ảnh mã nguồn mở", "mixed", "account", "mix", "Họ mô hình khuếch tán, nhiều bản mở chạy local.", "Tự chạy và tinh chỉnh được.", "Bản API Stability tính phí. Cần kiến thức vận hành.", "yppnp", "H84,P40,M36,U30", 86],
  ["leonardo", "Leonardo", "Leonardo", "Úc", "https://leonardo.ai", "Hình ảnh|Thiết kế", "Hình ảnh", "specialist", "Chuyên viên xưởng ảnh", "trial", "account", "trial", "Ứng dụng web tạo và chỉnh ảnh.", "Nhiều công cụ phụ trợ quanh ảnh trong một chỗ.", "Bậc miễn phí thay đổi. Số token ảnh chưa xác minh.", "yppnp", "H82,U48,W34", 64],
  ["ideogram", "Ideogram", "Ideogram", "Canada", "https://ideogram.ai", "Hình ảnh|Thiết kế|Viết nội dung", "Hình ảnh", "specialist", "Chuyên viên chữ trong ảnh", "trial", "account", "trial", "Tạo ảnh, mạnh hơn ở chữ hiển thị trong hình.", "Dùng được cho poster có tiêu đề ngắn.", "Chữ tiếng Việt dài vẫn dễ lỗi. Hạn mức chưa xác minh.", "ypnnp", "H86,W40,U44,D30", 68],
  ["firefly", "Adobe Firefly", "Adobe", "Hoa Kỳ", "https://www.adobe.com/products/firefly.html", "Hình ảnh|Thiết kế|Văn phòng", "Hình ảnh", "specialist", "Chuyên viên ảnh thương mại", "mixed", "account", "mix", "Tạo ảnh trong hệ Adobe, hướng tài sản dùng được trong doanh nghiệp.", "Gắn Photoshop và có chủ đích bản quyền dữ liệu huấn luyện.", "Tính bằng credit Adobe. Không phải kho mã.", "yppnp", "H80,U60,O64,W36", 60],
  ["recraft", "Recraft", "Recraft", "Chưa xác minh", "https://www.recraft.ai", "Hình ảnh|Thiết kế", "Hình ảnh", "specialist", "Chuyên viên ảnh vector", "trial", "account", "trial", "Tạo ảnh và vector theo hệ phong cách.", "Hợp icon và minh họa phẳng.", "Hạn mức và pháp nhân chưa xác minh đủ.", "upnnp", "H78,U70,W30", 58],
  ["comfy", "ComfyUI", "Comfy Org", "Chưa xác minh", "https://www.comfy.org", "Hình ảnh|Hạ tầng|Tự động hóa", "Hình ảnh", "specialist", "Chuyên viên đồ thị tạo ảnh", "oss", "local", "local", "Giao diện nút để chạy mô hình ảnh trên máy mình.", "Lắp được quy trình lặp lại, không tốn cước nếu đã có model.", "Khó với người không muốn vận hành.", "ypyy p".replace(" ", ""), "H80,M74,P50,G40,U36", 90],
  ["dalle", "DALL·E", "OpenAI", "Hoa Kỳ", "https://openai.com", "Hình ảnh|Thiết kế", "Hình ảnh", "specialist", "Chuyên viên ảnh trong hệ OpenAI", "mixed", "account", "mix", "Nhánh tạo ảnh của OpenAI, thường gặp trong ChatGPT.", "Ra ảnh nhanh từ câu chữ, cùng tài khoản OpenAI.", "Ít kiểm soát hơn công cụ ảnh chuyên. API tính phí.", "ypnnp", "H74,W40,U36,O30", 66],
  ["kling", "Kling", "Kuaishou", "Trung Quốc", "https://klingai.com", "Video|Hình ảnh", "Video", "specialist", "Chuyên viên tạo video", "trial", "account", "trial", "Tạo video từ chữ hoặc ảnh.", "Chuyển động người và cảnh tương đối ổn định.", "Hạn mức credit chưa xác minh. Xuất bản cần soát bản quyền.", "upnnp", "V90,H60,A20,W30", 63],
  ["runway", "Runway", "Runway", "Hoa Kỳ", "https://runwayml.com", "Video|Hình ảnh|Thiết kế", "Video", "lead", "Trưởng phòng Video", "trial", "account", "trial", "Bộ công cụ video sinh và chỉnh.", "Nhiều công cụ hậu kỳ trong một sản phẩm.", "Gói miễn phí mỏng hoặc không ổn định. Số credit chưa xác minh.", "yppnp", "V92,H64,U50,W36,M30", 61],
  ["veo", "Veo", "Google DeepMind", "Anh", "https://deepmind.google/models/veo/", "Video|Hình ảnh", "Video", "specialist", "Chuyên viên video mô hình lớn", "trial", "account", "trial", "Mô hình video của Google, phân phối qua các sản phẩm Google.", "Chất lượng cảnh cao khi được mở quyền.", "Quyền truy cập không đều. Không ghi hạn mức vì chưa xác minh.", "upnnp", "V91,H58,W28", 50],
  ["sora", "Sora", "OpenAI", "Hoa Kỳ", "https://openai.com/sora", "Video|Hình ảnh", "Video", "specialist", "Chuyên viên video", "trial", "account", "trial", "Mô hình video của OpenAI.", "Tạo cảnh từ mô tả khi tài khoản còn lượt.", "Trong hệ này đang để hết hạn mức để thử hàng đợi. Số lượt thật chưa xác minh.", "upnnp", "V90,H56,W30", 40],
  ["pika", "Pika", "Pika", "Hoa Kỳ", "https://pika.art", "Video|Hình ảnh", "Video", "specialist", "Chuyên viên clip ngắn", "trial", "account", "trial", "Tạo và biến đổi clip ngắn.", "Nhanh cho hiệu ứng và clip mạng xã hội.", "Khó giữ nhân vật xuyên suốt. Hạn mức chưa xác minh.", "upnnp", "V82,H50,U40", 64],
  ["luma", "Luma Dream Machine", "Luma AI", "Hoa Kỳ", "https://lumalabs.ai", "Video|Hình ảnh", "Video", "specialist", "Chuyên viên cảnh quay", "trial", "account", "trial", "Tạo video và cảnh từ mô tả hoặc ảnh.", "Ánh sáng và chuyển cảnh khá tự nhiên.", "Hạn mức dùng thử chưa xác minh.", "upnnp", "V84,H62,U34", 62],
  ["hailuo", "Hailuo", "MiniMax", "Trung Quốc", "https://www.minimax.io", "Video|Âm thanh|AI tổng quát", "Video", "specialist", "Chuyên viên video MiniMax", "trial", "account", "trial", "Nhánh video của MiniMax, kèm hệ mô hình riêng.", "Ra clip nhanh, có cả mô hình chữ của cùng nhà.", "Tên miền sản phẩm hay đổi. Hạn mức chưa xác minh.", "upppp", "V86,W50,A40,H40", 60],
  ["heygen", "HeyGen", "HeyGen", "Hoa Kỳ", "https://www.heygen.com", "Video|Âm thanh|Văn phòng", "Video", "specialist", "Chuyên viên người dẫn ảo", "trial", "account", "trial", "Tạo video người nói từ kịch bản.", "Hợp video thuyết minh có người dẫn.", "Dễ tạo nhầm nội dung mạo danh. Gói miễn phí chưa xác minh.", "yppnp", "V80,A74,W48,O40", 52],
  ["eleven", "ElevenLabs", "ElevenLabs", "Hoa Kỳ", "https://elevenlabs.io", "Âm thanh|Viết nội dung", "Âm thanh", "lead", "Trưởng phòng Giọng nói", "mixed", "account", "mix", "Tạo giọng nói và nhân bản giọng.", "Giọng tự nhiên, có API để gắn sản phẩm.", "Bậc miễn phí mỏng. Nhân bản giọng cần quyền của người thật.", "yppnp", "A96,W40,M36,O30", 58],
  ["whisper", "Whisper", "OpenAI", "Hoa Kỳ", "https://github.com/openai/whisper", "Âm thanh|Dịch thuật|Hạ tầng", "Âm thanh", "specialist", "Chuyên viên chuyển giọng thành chữ", "oss", "library", "oss", "Mô hình nhận dạng giọng nói mã nguồn mở.", "Chạy local để phiên âm không gửi audio đi.", "Không tạo giọng. Máy yếu thì chậm.", "nypyn", "A94,D60,P36,T30", 92],
  ["suno", "Suno", "Suno", "Hoa Kỳ", "https://suno.com", "Âm thanh|Viết nội dung", "Âm thanh", "specialist", "Chuyên viên nhạc", "trial", "account", "trial", "Tạo bài hát từ mô tả.", "Ra được cấu trúc bài và giọng hát.", "Bản quyền bài tạo ra cần đọc điều khoản hiện hành. Hạn mức chưa xác minh.", "upnnp", "A92,W44,H20", 57],
  ["descript", "Descript", "Descript", "Hoa Kỳ", "https://www.descript.com", "Âm thanh|Video|Văn phòng", "Âm thanh", "specialist", "Chuyên viên dựng theo văn bản", "trial", "account", "trial", "Sửa audio và video bằng cách sửa bản chữ.", "Cắt podcast và video như sửa tài liệu.", "Gói miễn phí hạn chế. Không phải mô hình lập trình.", "yppnp", "A78,V60,W66,O70,U40", 54],
  ["notebooklm", "NotebookLM", "Google", "Hoa Kỳ", "https://notebooklm.google.com", "Nghiên cứu|Giáo dục|Tri thức|Văn phòng", "Tri thức", "lead", "Trưởng phòng Tri thức", "web", "account", "web", "Sổ tay nguồn: chỉ trả lời từ tài liệu Chủ tịch đưa.", "Bám nguồn đã tải, hợp ôn bài và họp.", "Không biết việc ngoài tập tài liệu. API công khai chưa xác minh.", "upynp", "N90,W82,O84,D60,T40,E30", 80],
  ["elicit", "Elicit", "Elicit", "Hoa Kỳ", "https://elicit.com", "Nghiên cứu|Giáo dục", "Nghiên cứu", "specialist", "Chuyên viên đọc bài báo", "mixed", "account", "mix", "Tìm và bảng hóa bài nghiên cứu.", "Lọc bài và rút cột kết quả.", "Bậc đủ việc tính phí. Không thay phản biện chuyên gia.", "ypnnp", "N88,T64,W60,D40", 60],
  ["consensus", "Consensus", "Consensus", "Hoa Kỳ", "https://consensus.app", "Nghiên cứu|Giáo dục", "Nghiên cứu", "specialist", "Chuyên viên bằng chứng", "mixed", "account", "mix", "Tìm câu trả lời từ bài khoa học.", "Hỏi được có hay không có bằng chứng.", "Phủ không đều ngoài khối khoa học. Hạn mức chưa xác minh.", "upnnp", "N86,W58,T50", 62],
  ["scispace", "SciSpace", "Typeset", "Chưa xác minh", "https://scispace.com", "Nghiên cứu|Giáo dục", "Nghiên cứu", "specialist", "Chuyên viên đọc PDF khoa học", "mixed", "account", "mix", "Đọc và giải thích bài PDF.", "Hỏi trực tiếp trên một bài dài.", "Quốc gia pháp nhân chưa xác minh. Không thay soát phương pháp.", "upnnp", "N80,W64,D48,T36", 58],
  ["khanmigo", "Khanmigo", "Khan Academy", "Hoa Kỳ", "https://www.khanmigo.ai", "Giáo dục|Viết nội dung", "Giáo dục", "specialist", "Chuyên viên gia sư", "trial", "account", "trial", "Gia sư của Khan Academy, hỏi ngược học viên thay vì nộp bài hộ.", "Hợp luyện tập có sư phạm.", "Không phải công cụ sản xuất của công ty. Quyền dùng chưa xác minh.", "upnnp", "W70,N64,O60,D40", 50],
  ["deepl", "DeepL", "DeepL", "Đức", "https://www.deepl.com", "Dịch thuật|Viết nội dung", "Dịch thuật", "lead", "Trưởng phòng Dịch thuật", "mixed", "account", "mix", "Dịch máy chất lượng cao, có bản web và API.", "Giữ văn phong khá tự nhiên ở các cặp ngôn ngữ lớn.", "API tính phí. Tiếng chuyên ngành vẫn cần người soát.", "ypnnp", "D96,W60,N40,O36", 74],
  ["manus", "Manus", "Chưa xác minh", "Chưa xác minh", "https://manus.im", "AI Agent|Tự động hóa|Nghiên cứu", "AI Agent", "specialist", "Chuyên viên tác nhân tổng quát", "trial", "account", "trial", "Tác nhân làm việc nhiều bước trên web.", "Nhận mục tiêu rồi tự chia bước.", "Pháp nhân và hạn mức chưa xác minh đủ. Để trạng thái chờ đến khi Chủ tịch kích hoạt.", "uypyp", "G82,N70,M68,W50,P40,E36", 48],
  ["genspark", "Genspark", "Chưa xác minh", "Chưa xác minh", "https://www.genspark.ai", "Nghiên cứu|AI Agent", "Nghiên cứu", "specialist", "Chuyên viên tìm kiếm tác nhân", "trial", "account", "trial", "Công cụ tìm và tổng hợp theo dạng tác nhân.", "Gom được một hồ sơ chủ đề nhanh.", "Pháp nhân chưa xác minh. Cần soát nguồn trước khi dùng.", "upnnp", "N78,W66,G60,O40", 56],
  ["dola", "Dola AI", "Chưa xác minh", "Chưa xác minh", "", "AI tổng quát|Nghiên cứu", "AI tổng quát", "specialist", "Chuyên viên chưa xác minh hồ sơ", "web", "account", "web", "Có trong danh sách Chủ tịch yêu cầu khảo sát. Phiên này chưa xác minh được website chính thức.", "Chưa đủ hồ sơ để giao việc tự động.", "Không bịa hạn mức, năng lực hay đường dẫn. Đang chờ kích hoạt.", "uuuuu", "N20,W20", 30],
  ["openclaw", "OpenClaw", "Chưa xác minh", "Chưa xác minh", "", "AI Agent|Tự động hóa", "AI Agent", "specialist", "Chuyên viên chưa xác minh hồ sơ", "web", "account", "web", "Có trong danh sách khảo sát. Chưa xác minh sản phẩm công khai tương ứng.", "Chưa đủ hồ sơ để đưa vào vòng phân công.", "Không bịa website. Trạng thái chờ cho đến khi có nguồn.", "uuuuu", "G20,M20,P20", 30],
  ["crewai", "CrewAI", "CrewAI", "Hoa Kỳ", "https://www.crewai.com", "AI Agent|Tự động hóa|Lập trình", "AI Agent", "specialist", "Chuyên viên kíp tác nhân", "oss", "library", "lib", "Khung lập kíp nhiều tác nhân bằng Python.", "Chia vai rõ trong mã, dễ thử nghiệm.", "Cần model bên dưới. Không phải nhân viên chat sẵn.", "nyypp", "G86,M78,P70,K64,E40", 85],
  ["langgraph", "LangGraph", "LangChain", "Hoa Kỳ", "https://www.langchain.com/langgraph", "AI Agent|Tự động hóa|Lập trình", "AI Agent", "specialist", "Chuyên viên đồ thị tác nhân", "oss", "library", "lib", "Khung dựng tác nhân có trạng thái và vòng lặp.", "Kiểm soát được nhánh, phù hợp bộ điều phối giai đoạn 2.", "Là thư viện, không làm việc thay nếu chưa có mã và khóa.", "nyypp", "G90,M80,P76,K78,E50", 88],
  ["autogen", "AutoGen", "Microsoft", "Hoa Kỳ", "https://github.com/microsoft/autogen", "AI Agent|Lập trình|Tự động hóa", "AI Agent", "specialist", "Chuyên viên hội thoại nhiều tác nhân", "oss", "library", "lib", "Khung nhiều tác nhân của Microsoft.", "Thí nghiệm được vai trò tranh luận trong mã.", "API bề mặt hay đổi giữa các phiên bản.", "nyypp", "G84,P72,M70,K66,E44", 80],
  ["dify", "Dify", "LangGenius", "Chưa xác minh", "https://dify.ai", "AI Agent|Tự động hóa|Hạ tầng", "AI Agent", "lead", "Trưởng phòng Nền tảng Agent", "oss", "account", "oss", "Nền tảng dựng ứng dụng LLM, có bản tự host.", "Có giao diện cho người không viết hết khung tác nhân.", "Quốc gia pháp nhân chưa xác minh. Cloud và bản tự host khác nhau về hạn mức.", "yyyy p".replace(" ", ""), "G82,M84,P60,O66,K58,U50", 77],
  ["n8n", "n8n", "n8n", "Đức", "https://n8n.io", "Tự động hóa|AI Agent|Văn phòng", "Tự động hóa", "lead", "Trưởng phòng Tự động hóa", "mixed", "account", "mix", "Công cụ nối luồng, có bản tự host và cloud.", "Nối API, lịch và nhánh điều kiện mà không khóa một model.", "Giấy phép fair-code, không phải OSI thuần. Hạn mức cloud chưa xác minh.", "yyppy", "M94,G70,P48,O60,T40,E36", 82],
  ["make", "Make", "Make", "Séc", "https://www.make.com", "Tự động hóa|Văn phòng", "Tự động hóa", "specialist", "Chuyên viên kịch bản đám mây", "trial", "account", "trial", "Nền tảng tự động hóa trực quan.", "Nhiều đầu nối SaaS sẵn.", "Tính theo thao tác. Bậc miễn phí chưa xác minh con số.", "yyppy", "M86,O64,G40,T36", 50],
  ["zapier", "Zapier", "Zapier", "Hoa Kỳ", "https://zapier.com", "Tự động hóa|Văn phòng", "Tự động hóa", "specialist", "Chuyên viên nối ứng dụng", "trial", "account", "trial", "Nối ứng dụng bằng zap.", "Dễ cho luồng văn phòng ngắn.", "Đắt khi nhiều bước. Không phải nơi sửa mã.", "yypnp", "M84,O70,G36,T30", 48],
  ["activepieces", "Activepieces", "Activepieces", "Chưa xác minh", "https://www.activepieces.com", "Tự động hóa|Hạ tầng", "Tự động hóa", "specialist", "Chuyên viên tự động hóa mở", "oss", "library", "oss", "Công cụ luồng mã nguồn mở, tự host được.", "Thay một phần Zapier mà không khóa cloud.", "Ít đầu nối hơn các nền lớn. Quốc gia chưa xác minh.", "yyppy", "M80,P40,G48,O36", 78],
  ["flowise", "Flowise", "Flowise", "Chưa xác minh", "https://flowiseai.com", "AI Agent|Tự động hóa", "AI Agent", "specialist", "Chuyên viên kéo thả LLM", "oss", "local", "oss", "Giao diện nút để dựng luồng LLM.", "Thử chuỗi prompt mà không viết hết khung.", "Vẫn cần khóa model. Quốc gia chưa xác minh.", "nyypp", "G72,M76,P36,U40", 74],
  ["openwebui", "Open WebUI", "Open WebUI", "Chưa xác minh", "https://openwebui.com", "Hạ tầng|AI tổng quát", "Hạ tầng", "specialist", "Chuyên viên giao diện model local", "oss", "local", "local", "Giao diện web cho Ollama và API tương thích.", "Cho cả nhóm một cửa chat trên model tự chạy.", "Không tự sinh trí tuệ nếu chưa có model phía sau.", "yppnp", "O60,G40,M50,P30,U48", 86],
  ["playwright", "Playwright", "Microsoft", "Hoa Kỳ", "https://playwright.dev", "Kiểm thử|Tự động hóa|Lập trình", "Kiểm thử", "lead", "Trưởng phòng Kiểm thử", "oss", "library", "lib", "Thư viện tự động hóa trình duyệt.", "Chạy được kịch bản end-to-end và lưu vết.", "Không suy nghĩ hộ phần sửa sản phẩm. Cần người viết kịch bản hoặc tác nhân khác.", "nyyyy", "P70,L60,K50,N30,W24,D16,H4,V4,A4,T36,M78,G55,E98,S48,O22,U40", 96],
  ["browseruse", "Browser Use", "Browser Use", "Chưa xác minh", "https://browser-use.com", "Kiểm thử|AI Agent|Tự động hóa", "Kiểm thử", "specialist", "Chuyên viên trình duyệt cho tác nhân", "oss", "library", "lib", "Thư viện để tác nhân thao tác trình duyệt.", "Nối model với thao tác web có kiểm soát.", "Dễ làm sai trên site thật nếu không có hàng rào. Quốc gia chưa xác minh.", "nyyyy", "G78,E74,M70,P60,S36", 70],
  ["cypress", "Cypress", "Cypress", "Hoa Kỳ", "https://www.cypress.io", "Kiểm thử|Lập trình", "Kiểm thử", "specialist", "Chuyên viên kiểm thử giao diện", "mixed", "account", "mix", "Công cụ kiểm thử đầu cuối, có bản mở và cloud.", "Xem được từng bước trên trình duyệt.", "Cloud tính phí. Không phải mô hình ngôn ngữ.", "nyyy n".replace(" ", ""), "E90,P66,U40,L50,M40", 80],
  ["semgrep", "Semgrep", "Semgrep", "Hoa Kỳ", "https://semgrep.dev", "Bảo mật|Kiểm thử|Lập trình", "Bảo mật", "specialist", "Chuyên viên luật mã tĩnh", "mixed", "account", "mix", "Quét mã theo luật, có bản mở và nền tảng.", "Bắt lỗi bảo mật lặp lại trong pull request.", "Luật mặc định không phủ hết nghiệp vụ. Cloud tính phí.", "ypyy n".replace(" ", ""), "S92,P50,E70,L40,M36", 76],
  ["snyk", "Snyk", "Snyk", "Israel", "https://snyk.io", "Bảo mật|Hạ tầng", "Bảo mật", "specialist", "Chuyên viên phụ thuộc và ảnh chứa", "trial", "account", "trial", "Quét lỗ hổng phụ thuộc, ảnh và mã.", "Nhìn được CVE trong thư viện đang dùng.", "Bản đủ việc tính phí. Không sửa kiến trúc hộ.", "ypyy n".replace(" ", ""), "S90,P36,E60,M40,T30", 58],
  ["zaproxy", "OWASP ZAP", "OWASP", "Quốc tế", "https://www.zaproxy.org", "Bảo mật|Kiểm thử", "Bảo mật", "specialist", "Chuyên viên dò ứng dụng web", "oss", "local", "local", "Công cụ dò lỗi bảo mật ứng dụng web.", "Chạy local, hợp kiểm tra trước khi phát hành.", "Cần người đọc kết quả. Quét ẩu có thể làm phiền hệ thống.", "nyypp", "S88,E64,M40,P30", 84],
  ["hf", "Hugging Face", "Hugging Face", "Hoa Kỳ", "https://huggingface.co", "Hạ tầng|AI tổng quát|Lập trình", "Hạ tầng", "lead", "Trưởng phòng Mô hình mở", "mixed", "account", "mix", "Kho model, dataset và không gian chạy thử.", "Nơi lấy model mở và thử nhanh.", "Inference API có bậc miễn phí thay đổi. Không ghi số phút vì chưa xác minh.", "yppnp", "P60,M64,G58,N50,H40,T48,K40", 75],
  ["ollama", "Ollama", "Ollama", "Hoa Kỳ", "https://ollama.com", "Hạ tầng|AI tổng quát|Lập trình", "Hạ tầng", "lead", "Trưởng phòng Suy luận cục bộ", "oss", "local", "local", "Chạy mô hình ngôn ngữ trên máy cá nhân.", "Đổi nhà cung cấp bằng cách kéo model về máy.", "Chất lượng và tốc độ theo GPU. Không có tác nhân sửa kho sẵn.", "ypppp", "P40,M50,G36,K30,S40,O30", 94],
  ["lmstudio", "LM Studio", "LM Studio", "Chưa xác minh", "https://lmstudio.ai", "Hạ tầng|AI tổng quát", "Hạ tầng", "specialist", "Chuyên viên chạy model trên máy", "oss", "local", "local", "Ứng dụng desktop tải và chat với model mở.", "Dễ hơn Ollama với người muốn giao diện.", "Quốc gia và giấy phép từng bản cần xem tại trang tải. Không phải API đám mây.", "ypnnp", "O40,P24,M30,G20", 90],
  ["groq", "Groq", "Groq", "Hoa Kỳ", "https://groq.com", "Hạ tầng|Lập trình", "Hạ tầng", "specialist", "Chuyên viên suy luận nhanh", "api-free", "account", "freeapi", "Dịch vụ chạy model rất nhanh, khác với Grok của xAI.", "Độ trễ thấp cho bản nháp và phân loại.", "Bậc miễn phí có trần nhưng con số không ghi vì chưa xác minh phiên này.", "ypnnp", "P36,M40,G30,T28", 70],
  ["openrouter", "OpenRouter", "OpenRouter", "Hoa Kỳ", "https://openrouter.ai", "Hạ tầng|AI tổng quát", "Hạ tầng", "specialist", "Chuyên viên cổng nhiều model", "mixed", "account", "freeapi", "Một API gọi nhiều model của nhiều nhà.", "Đổi model khi một nhà hết hạn mà không viết lại ứng dụng.", "Phần lớn model tính phí. Model giá 0 thay đổi, không liệt kê trần.", "ypnnp", "M48,G40,P30,K36,N30", 72],
  ["github", "GitHub", "GitHub", "Hoa Kỳ", "https://github.com", "Hạ tầng|Lập trình|Quản lý dự án", "Hạ tầng", "specialist", "Chuyên viên kho mã và CI", "mixed", "account", "mix", "Nơi giữ mã, review, Actions và phát hành.", "Lịch sử, pull request và chạy kiểm thử tự động.", "Không phải mô hình. Bản riêng tư và phút Actions có điều kiện chưa xác minh.", "yyyyy", "M70,E60,P40,S50,O66,K36", 90],
  ["vercel", "Vercel", "Vercel", "Hoa Kỳ", "https://vercel.com", "Hạ tầng|Thiết kế", "Hạ tầng", "specialist", "Chuyên viên triển khai giao diện", "mixed", "account", "mix", "Nền tảng triển khai ứng dụng web.", "Đưa bản xem trước cho từng nhánh.", "Bản thương mại tính phí. Không thay cơ sở dữ liệu riêng nếu chưa gắn.", "ypnnp", "M60,U40,P30,E36,O40", 68],
  ["cloudflare", "Cloudflare", "Cloudflare", "Hoa Kỳ", "https://www.cloudflare.com", "Hạ tầng|Bảo mật", "Hạ tầng", "specialist", "Chuyên viên biên mạng", "mixed", "account", "mix", "Mạng biên, DNS, Workers và bảo vệ.", "Đưa API và trang tĩnh ra gần người dùng.", "Workers AI và bậc miễn phí hay đổi. Không ghi trần.", "ypnnp", "M58,S64,P36,E30", 70],
  ["replicate", "Replicate", "Replicate", "Hoa Kỳ", "https://replicate.com", "Hạ tầng|Hình ảnh|Video", "Hạ tầng", "specialist", "Chuyên viên chạy model theo lần", "api-paid", "account", "paid", "Chạy model mở trên đám mây, trả theo thời gian.", "Thử model ảnh và video mà không dựng GPU.", "Phát sinh chi phí theo giây. Không bật nếu Chủ tịch chưa duyệt trả phí.", "ypnnp", "H40,V40,M50,P30,A30", 36],
  ["fal", "fal", "fal", "Chưa xác minh", "https://fal.ai", "Hạ tầng|Hình ảnh|Video", "Hạ tầng", "specialist", "Chuyên viên suy luận ảnh và video", "api-paid", "account", "paid", "API chạy model ảnh và video.", "Nhanh để gắn vào sản phẩm.", "Tính phí. Quốc gia pháp nhân chưa xác minh.", "ypnnp", "H36,V36,M44,P24", 34],
  ["jan", "Jan", "Jan", "Chưa xác minh", "https://jan.ai", "Hạ tầng|AI tổng quát", "Hạ tầng", "specialist", "Chuyên viên chat local", "oss", "local", "local", "Ứng dụng chat với model mở trên máy.", "Giao diện gọn cho người không muốn dòng lệnh.", "Quốc gia chưa xác minh. Vẫn cần model và máy đủ mạnh.", "ypnnp", "O36,P20,M24,G18", 82],
  ["llamacpp", "llama.cpp", "Georgi Gerganov và cộng đồng", "Chưa xác minh", "https://github.com/ggerganov/llama.cpp", "Hạ tầng|Lập trình", "Hạ tầng", "specialist", "Chuyên viên suy luận tiết kiệm", "oss", "library", "lib", "Chạy mô hình lượng tử hóa trên CPU và GPU.", "Chạy được khi không có hạ tầng đám mây.", "Cần người biết định dạng model. Không có giao diện nghiệp vụ.", "ypnnp", "P48,M30,K24,S20", 88],
  ["supabase", "Supabase", "Supabase", "Hoa Kỳ", "https://supabase.com", "Cơ sở dữ liệu|Hạ tầng", "Cơ sở dữ liệu", "specialist", "Chuyên viên Postgres ứng dụng", "mixed", "account", "mix", "Postgres, auth và lưu tệp có bậc miễn phí.", "Dựng backend dữ liệu nhanh.", "Trần bậc miễn phí không ghi số vì chưa xác minh. Không phải mô hình.", "ypnny", "T70,P40,M50,S36,O30", 74],
  ["neon", "Neon", "Neon", "Hoa Kỳ", "https://neon.tech", "Cơ sở dữ liệu|Hạ tầng", "Cơ sở dữ liệu", "specialist", "Chuyên viên Postgres tách biệt", "mixed", "account", "mix", "Postgres serverless, tách nhánh theo môi trường.", "Tạo bản dữ liệu theo nhánh khi thử việc.", "Hạn mức miễn phí chưa xác minh. Không xử lý ngôn ngữ.", "ypnnn", "T64,M40,P24,S20", 70],
  ["duckdb", "DuckDB", "DuckDB Labs", "Hà Lan", "https://duckdb.org", "Dữ liệu|Cơ sở dữ liệu", "Dữ liệu", "specialist", "Chuyên viên phân tích tại chỗ", "oss", "library", "lib", "Máy truy vấn phân tích chạy trong tiến trình.", "Đọc CSV và parquet tại máy, không cần máy chủ.", "Không phải kho giao dịch cho ứng dụng nhiều người viết.", "nynnn", "T92,P36,M30,E24", 95],
  ["metabase", "Metabase", "Metabase", "Hoa Kỳ", "https://www.metabase.com", "Dữ liệu|Văn phòng", "Dữ liệu", "specialist", "Chuyên viên bảng hỏi dữ liệu", "mixed", "account", "mix", "Đặt câu hỏi lên cơ sở dữ liệu bằng giao diện.", "Cho người không viết SQL xem được số.", "Bản đủ tính năng tính phí. Câu hỏi mơ hồ vẫn ra số sai.", "ypnnp", "T84,O70,W40,U36", 72],
  ["notion", "Notion", "Notion", "Hoa Kỳ", "https://www.notion.com", "Văn phòng|Quản lý dự án|Viết nội dung", "Văn phòng", "specialist", "Chuyên viên kho tri thức nhóm", "mixed", "account", "mix", "Tài liệu, cơ sở nhẹ và trợ lý viết trong trang.", "Giữ quyết định và tài liệu cạnh nhau.", "AI của Notion tính phí thêm. Không sửa kho mã.", "yppnp", "O88,W74,N40,M36,U30", 78],
  ["linear", "Linear", "Linear", "Hoa Kỳ", "https://linear.app", "Quản lý dự án|Văn phòng", "Quản lý dự án", "lead", "Trưởng phòng Điều phối dự án", "trial", "account", "trial", "Theo dõi issue và chu kỳ làm phần mềm.", "Hàng đợi việc rõ, ít nhiễu.", "Không có trí tuệ lập trình. Bậc miễn phí đội nhỏ chưa xác minh số ghế.", "ypnnp", "O86,M40,W36,E24", 73],
  ["figma", "Figma", "Figma", "Hoa Kỳ", "https://www.figma.com", "Thiết kế|Giao diện", "Thiết kế", "specialist", "Chuyên viên thiết kế giao diện", "mixed", "account", "mix", "Công cụ thiết kế giao diện, có tính năng sinh và viết trong file.", "Nơi thống nhất màn hình trước khi giao mã.", "Tính năng AI không đồng nghĩa bản thiết kế miễn phí không giới hạn.", "yppnp", "U92,H50,W36,O40", 76],
  ["canva", "Canva", "Canva", "Úc", "https://www.canva.com", "Thiết kế|Hình ảnh|Văn phòng", "Thiết kế", "specialist", "Chuyên viên ấn phẩm", "mixed", "account", "mix", "Dàn trang và công cụ Magic Studio.", "Ra ấn phẩm văn phòng nhanh từ mẫu.", "Khó thành hệ thống thiết kế cho sản phẩm phần mềm.", "yppnp", "H70,U74,W50,O66,V30", 80],
  ["gamma", "Gamma", "Gamma", "Chưa xác minh", "https://gamma.app", "Văn phòng|Thiết kế|Viết nội dung", "Văn phòng", "specialist", "Chuyên viên bản trình bày", "trial", "account", "trial", "Sinh bản trình bày từ dàn ý.", "Ra được bản nhìn được rất nhanh.", "Dễ đồng dạng. Quốc gia và hạn mức chưa xác minh.", "upnnp", "W68,U70,O64,H30", 60],
  ["otter", "Otter", "Otter.ai", "Hoa Kỳ", "https://otter.ai", "Văn phòng|Âm thanh", "Văn phòng", "specialist", "Chuyên viên biên bản họp", "trial", "account", "trial", "Phiên âm cuộc họp.", "Ra biên bản và mục hành động.", "Cần sự đồng ý người họp. Phút miễn phí chưa xác minh.", "ypnnp", "A70,W64,O78,D36", 56],
  ["m365", "Microsoft 365 Copilot", "Microsoft", "Hoa Kỳ", "https://www.microsoft.com/microsoft-365/copilot", "Văn phòng|Viết nội dung|Dữ liệu", "Văn phòng", "specialist", "Chuyên viên trong bộ Office", "api-paid", "account", "paid", "Copilot gắn Word, Excel, Outlook và Teams.", "Làm trên tài liệu công ty đã có.", "Là gói trả phí. Không kích hoạt nếu chưa có bản quyền.", "yppnp", "O90,W76,T60,D40,N36", 30],
  ["phind", "Phind", "Phind", "Hoa Kỳ", "https://www.phind.com", "Nghiên cứu|Lập trình", "Nghiên cứu", "specialist", "Chuyên viên đọc tài liệu kỹ thuật", "mixed", "account", "mix", "Công cụ hỏi đáp thiên về lập trình và tài liệu kỹ thuật.", "Bám tài liệu và ví dụ mã hơn chat tổng quát.", "Không sửa cả kho. Hạn mức và mô hình phía sau chưa xác minh.", "ypnnp", "N84,P78,L70,W60,K56", 64],
  ["you", "You.com", "You.com", "Hoa Kỳ", "https://you.com", "AI tổng quát|Nghiên cứu", "AI tổng quát", "specialist", "Chuyên viên tìm kiếm hội thoại", "mixed", "account", "mix", "Cửa tìm kiếm có nhiều mô hình và tác nhân.", "Đổi chế độ tìm và chat trong một chỗ.", "Chất lượng phụ thuộc mode. Hạn mức chưa xác minh.", "ypnnp", "N76,W68,D60,P36,O40", 62],
  ["grammarly", "Grammarly", "Grammarly", "Hoa Kỳ", "https://www.grammarly.com", "Viết nội dung|Văn phòng", "Văn phòng", "specialist", "Chuyên viên soát câu chữ", "mixed", "account", "mix", "Soát ngữ pháp, giọng văn và viết lại câu.", "Bắt lỗi câu khi soạn thư và tài liệu.", "Không phải mô hình lập trình. Gói đủ việc tính phí. Hạn mức chưa xác minh.", "ypnnp", "W88,O70,D64,N30", 70],
  ["zhipu", "GLM", "Zhipu AI", "Trung Quốc", "https://www.zhipuai.cn", "AI tổng quát|Lập trình", "Lập trình", "specialist", "Chuyên viên mô hình GLM", "mixed", "account", "mix", "Dòng mô hình GLM cho chat, mã và API.", "Lựa chọn thêm khi cần mô hình tiếng Trung.", "Bề mặt sản phẩm hay đổi. Hạn mức miễn phí chưa xác minh.", "ypppp", "P82,L76,N64,W66,D80,K58", 68],
  ["trae", "Trae", "ByteDance", "Trung Quốc", "https://www.trae.ai", "Coding Agent|Lập trình", "Coding Agent", "specialist", "Chuyên viên IDE tác nhân", "trial", "account", "trial", "IDE có trợ lý mã của ByteDance.", "Sửa trong editor, cùng lớp với các IDE agent.", "Hạn mức và điều khoản dữ liệu chưa xác minh.", "pyyyy", "P84,L80,G76,U58,K60,E48", 60],
  ["amazonq", "Amazon Q Developer", "Amazon", "Hoa Kỳ", "https://aws.amazon.com/q/", "Lập trình|Hạ tầng|Bảo mật", "Lập trình", "specialist", "Chuyên viên mã trên AWS", "mixed", "account", "mix", "Trợ lý lập trình gắn hệ Amazon Web Services.", "Hợp kho đang chạy trên AWS.", "Gắn tài khoản AWS. Không phải lựa chọn mặc định ngoài hệ đó. Hạn mức chưa xác minh.", "pyyyp", "P78,L70,K64,S60,M48,E40", 55],
  ["tabnine", "Tabnine", "Tabnine", "Israel", "https://www.tabnine.com", "Lập trình|Coding Agent", "Lập trình", "specialist", "Chuyên viên gợi ý mã", "mixed", "account", "mix", "Trợ lý hoàn thiện mã, có lựa chọn chạy riêng.", "Gợi ý trong editor mà không buộc một model đám mây.", "Không thay tác nhân sửa cả kho. Hạn mức chưa xác minh.", "yppnp", "P80,L66,S40,U36", 64],
  ["langsmith", "LangSmith", "LangChain", "Hoa Kỳ", "https://smith.langchain.com", "AI Agent|Kiểm thử|Dữ liệu", "AI Agent", "specialist", "Chuyên viên quan sát tác nhân", "mixed", "account", "mix", "Nền tảng lần vết, đánh giá và gỡ lỗi ứng dụng LLM.", "Xem được từng bước của một tác nhân khi có sự cố.", "Không tự làm việc thay. Bậc miễn phí chưa xác minh.", "ypnnp", "G70,E72,T60,K50,M40", 66],
  ["coze", "Coze", "ByteDance", "Trung Quốc", "https://www.coze.com", "AI Agent|Tự động hóa", "AI Agent", "specialist", "Chuyên viên dựng bot", "trial", "account", "trial", "Nền tảng dựng bot và tác nhân không cần viết hết khung.", "Ra bot có công cụ nhanh.", "Khóa vào nền của nhà phát triển. Hạn mức chưa xác minh.", "yppyp", "G74,M70,O60,W48,U40", 58],
  ["tavily", "Tavily", "Tavily", "Hoa Kỳ", "https://tavily.com", "Nghiên cứu|AI Agent", "Nghiên cứu", "specialist", "Chuyên viên tìm kiếm cho tác nhân", "api-free", "account", "freeapi", "API tìm web dành cho tác nhân, có nhắc bậc không mất phí.", "Gắn vào bộ điều phối khi cần nguồn web.", "Trần lượt miễn phí không ghi vì chưa xác minh phiên này.", "ypnnp", "N80,M50,G40,W30", 72],
  ["exa", "Exa", "Exa", "Hoa Kỳ", "https://exa.ai", "Nghiên cứu|Dữ liệu", "Nghiên cứu", "specialist", "Chuyên viên tìm theo nghĩa", "api-paid", "account", "paid", "API tìm web theo ngữ nghĩa cho ứng dụng.", "Lấy trang phù hợp hơn từ khóa thô.", "Tính phí. Không dùng nếu Chủ tịch chưa duyệt chi phí.", "ypnnp", "N78,T40,M36,G30", 40],
  ["together", "Together AI", "Together AI", "Hoa Kỳ", "https://www.together.ai", "Hạ tầng|Lập trình", "Hạ tầng", "specialist", "Chuyên viên chạy model mở", "mixed", "account", "freeapi", "Nền tảng suy luận model mở, có model giá 0 thay đổi theo thời điểm.", "Đổi model mở qua một API.", "Model miễn phí không ổn định. Không ghi trần token.", "ypnnp", "P40,M48,G36,K30", 68],
  ["fireworks", "Fireworks", "Fireworks", "Hoa Kỳ", "https://fireworks.ai", "Hạ tầng|Lập trình", "Hạ tầng", "specialist", "Chuyên viên suy luận model", "api-paid", "account", "paid", "API chạy model mở tốc độ cao.", "Hợp sản phẩm cần độ trễ thấp.", "Kênh chính tính phí. Không bật nếu chưa duyệt.", "ypnnp", "P36,M44,G30", 38],
  ["modal", "Modal", "Modal", "Hoa Kỳ", "https://modal.com", "Hạ tầng|Lập trình", "Hạ tầng", "specialist", "Chuyên viên chạy job GPU", "mixed", "account", "mix", "Nền tảng chạy hàm và job trên GPU.", "Chạy model tự host theo lần gọi.", "Phát sinh cước khi vượt bậc. Trần miễn phí chưa xác minh.", "ypnnp", "P48,M60,K40,S30", 52],
  ["railway", "Railway", "Railway", "Hoa Kỳ", "https://railway.com", "Hạ tầng|Cơ sở dữ liệu", "Hạ tầng", "specialist", "Chuyên viên triển khai dịch vụ", "trial", "account", "trial", "Triển khai ứng dụng, cơ sở dữ liệu và worker.", "Đưa backend lên nhanh từ kho git.", "Hết credit thì dịch vụ dừng. Số credit chưa xác minh.", "ypnnp", "M58,P30,T24,E30", 50],
  ["docker", "Docker", "Docker", "Hoa Kỳ", "https://www.docker.com", "Hạ tầng|Lập trình", "Hạ tầng", "specialist", "Chuyên viên đóng gói môi trường", "mixed", "account", "mix", "Đóng gói ứng dụng và công cụ thành image.", "Cho tác nhân một môi trường chạy lặp lại được.", "Bản Hub và Desktop có điều kiện dùng. Không phải mô hình.", "nynny", "M64,P40,S36,E30", 84],
  ["gitlab", "GitLab", "GitLab", "Hoa Kỳ", "https://about.gitlab.com", "Hạ tầng|Lập trình|Quản lý dự án", "Hạ tầng", "specialist", "Chuyên viên kho mã và CI", "mixed", "account", "mix", "Kho mã, review, CI và phát hành, có bản tự host.", "Giữ lịch sử và chạy kiểm thử khi không dùng GitHub.", "Phút CI và bậc miễn phí chưa xác minh.", "yyyyy", "M68,E58,P36,O60,S40", 80],
  ["sentry", "Sentry", "Sentry", "Hoa Kỳ", "https://sentry.io", "Kiểm thử|Hạ tầng", "Kiểm thử", "specialist", "Chuyên viên lỗi vận hành", "mixed", "account", "mix", "Thu lỗi và hiệu năng từ ứng dụng đang chạy.", "Chỉ đúng chỗ vỡ sau khi phát hành.", "Không sửa mã hộ. Trần sự kiện miễn phí chưa xác minh.", "ypnnp", "E80,L70,T36,S40", 70],
  ["posthog", "PostHog", "PostHog", "Hoa Kỳ", "https://posthog.com", "Dữ liệu|Kiểm thử", "Dữ liệu", "specialist", "Chuyên viên đo sản phẩm", "mixed", "account", "mix", "Phân tích sản phẩm, session và cờ tính năng, có bản tự host.", "Cho biết người dùng kẹt ở đâu.", "Dễ thu dữ liệu thừa nếu không cấu hình. Hạn mức chưa xác minh.", "ypnnp", "T78,E40,O36,M30", 66],
  ["udio", "Udio", "Udio", "Hoa Kỳ", "https://www.udio.com", "Âm thanh|Viết nội dung", "Âm thanh", "specialist", "Chuyên viên nhạc", "trial", "account", "trial", "Tạo nhạc từ mô tả, cùng lớp với Suno.", "Ra bài hát khi cần nhạc nền.", "Bản quyền tác phẩm sinh ra cần đọc điều khoản hiện hành. Hạn mức chưa xác minh.", "upnnp", "A88,W40,H16", 54],
  ["fish", "Fish Audio", "Fish Audio", "Chưa xác minh", "https://fish.audio", "Âm thanh", "Âm thanh", "specialist", "Chuyên viên giọng nói", "mixed", "account", "mix", "Tạo giọng, có mô hình mở và dịch vụ cloud.", "Phương án giọng khi ElevenLabs hết lượt.", "Quốc gia và hạn mức cloud chưa xác minh.", "ypnnp", "A84,W30,M24", 70],
  ["capcut", "CapCut", "ByteDance", "Trung Quốc", "https://www.capcut.com", "Video|Thiết kế", "Video", "specialist", "Chuyên viên dựng clip", "mixed", "account", "mix", "Ứng dụng dựng video, có công cụ sinh phụ đề và hiệu ứng.", "Dựng nhanh clip ngắn sau khi có cảnh.", "Không phải mô hình cảnh dài. Điều khoản dữ liệu cần Chủ tịch xét.", "yppnp", "V70,H40,U48,A30", 72],
  ["synthesia", "Synthesia", "Synthesia", "Anh", "https://www.synthesia.io", "Video|Văn phòng|Âm thanh", "Video", "specialist", "Chuyên viên video người dẫn", "api-paid", "account", "paid", "Tạo video đào tạo với người dẫn ảo.", "Hợp video nội bộ có kịch bản cố định.", "Gói tính phí. Không dùng để làm video mạo danh.", "ypnnp", "V76,A70,W50,O60", 36],
  ["miro", "Miro", "Miro", "Hà Lan", "https://miro.com", "Văn phòng|Thiết kế|Quản lý dự án", "Văn phòng", "specialist", "Chuyên viên bảng trắng", "mixed", "account", "mix", "Bảng cộng tác, có tính năng tóm tắt bảng.", "Giữ sơ đồ việc của cả nhóm.", "AI trên bảng không thay người thiết kế. Hạn mức chưa xác minh.", "ypnnp", "O72,U60,W40,K30", 68],
  ["framer", "Framer", "Framer", "Hà Lan", "https://www.framer.com", "Thiết kế|Lập trình", "Thiết kế", "specialist", "Chuyên viên trang phát hành", "mixed", "account", "mix", "Thiết kế và xuất bản trang, có sinh bố cục.", "Ra trang giới thiệu nhanh.", "Không phải nơi xây hệ thống nhiều màn phức tạp. Hạn mức chưa xác minh.", "yppnp", "U84,H40,W48,P36", 64],
];

function toStaff(row: Row): Staff {
  const [id, name, developer, country, website, groups, department, rank, title, access, meter, note, summary, strength, weakness, caps, skill, budget] = row;
  return {
    id,
    name,
    developer,
    country,
    website,
    groups: groups.split("|").map((g) => g.trim()).filter(Boolean),
    department,
    rank,
    title,
    access,
    meter,
    accessNote: NOTES[note],
    summary,
    strength,
    weakness,
    ...capsOf(caps, id),
    skills: skillsOf(skill, id),
    budget,
    checkedAt: CHECKED_AT,
    source: website || "Chưa có URL chính thức đã xác minh trong phiên 2026-11-20.",
  };
}

export const STAFF: Staff[] = ROWS.map(toStaff);

const ids = new Set<string>();
for (const person of STAFF) {
  if (ids.has(person.id)) throw new Error(`Trùng mã nhân sự ${person.id}`);
  ids.add(person.id);
  if (!CHIEFS[person.department]) throw new Error(`Chưa có giám đốc cho phòng ${person.department} (${person.id})`);
}

export function mergeRoster(over: Record<string, StaffOver>): LiveStaff[] {
  return STAFF.map((person) => {
    const patch = over[person.id] ?? {};
    return {
      ...person,
      skills: { ...person.skills, ...patch.skills },
      rank: patch.rank ?? person.rank,
      title: patch.title ?? person.title,
      budget: patch.budget ?? person.budget,
      status: patch.status ?? "active",
      ok: patch.ok ?? 0,
      bad: patch.bad ?? 0,
    };
  });
}

export function staffById(roster: LiveStaff[], id: string | null) {
  if (!id) return undefined;
  return roster.find((person) => person.id === id);
}
