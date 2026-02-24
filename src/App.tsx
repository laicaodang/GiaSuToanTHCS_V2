import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  GraduationCap, 
  User, 
  Sparkles, 
  ChevronRight, 
  RefreshCcw, 
  MessageSquare,
  BookOpen,
  AlertCircle,
  Paperclip,
  X,
  FileText,
  Zap,
  BrainCircuit,
  Cpu,
  Layers,
  ArrowRight,
  Dumbbell,
  Target,
  Trophy,
  HelpCircle,
  Info,
  Lightbulb,
  CheckCircle2,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Key,
  Save
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import mammoth from 'mammoth';
import { motion, AnimatePresence } from 'motion/react';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Gemini API Helper
const callGeminiAPI = async (contents: any[], systemInstruction?: string, providedKey?: string) => {
  const apiKey = providedKey || localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    throw new Error("Vui lòng nhập API Key trước khi bắt đầu");
  }

  // 1. The Fallback List: Endpoints to test in exact order
  const baseEndpoints = [
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent',
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'
  ];

  // 2. Auto-Discovery Logic: Use saved working endpoint first if available
  const savedBaseUrl = localStorage.getItem('gemini_working_base_url');
  const endpointsToTry = savedBaseUrl 
    ? [savedBaseUrl, ...baseEndpoints.filter(u => u !== savedBaseUrl)]
    : baseEndpoints;

  let lastError: any = null;

  for (const baseUrl of endpointsToTry) {
    const url = `${baseUrl}?key=${apiKey}`;
    const payload: any = { contents };
    if (systemInstruction) {
      payload.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP Error: ${response.status}`;
        
        // If 404 or "Requested entity was not found", try next URL silently
        if (response.status === 404 || 
            errorMessage.toLowerCase().includes("not found") || 
            errorMessage.includes("Requested entity was not found")) {
            lastError = new Error(errorMessage);
            continue;
        }

        // For other errors (like 400 Invalid Key), stop and throw
        throw new Error(errorMessage);
      }

      // 200 OK: Success! Save this working endpoint for future requests
      localStorage.setItem('gemini_working_base_url', baseUrl);
      return await response.json();
    } catch (error: any) {
      lastError = error;
      
      // If network error or "not found", continue to next endpoint
      if (error.message.includes("Failed to fetch") || 
          error.message.toLowerCase().includes("not found") || 
          error.message.includes("Requested entity was not found")) {
          continue;
      }

      throw error;
    }
  }

  // 3. Final Error Handling: Only show if ALL endpoints fail
  throw new Error("Không thể kết nối với máy chủ AI. Vui lòng kiểm tra lại cấu hình API Key hoặc VPN.");
};

// Types
type Grade = '6' | '7' | '8' | '9';

const TOPICS: Record<Grade, string[]> = {
  '6': ['Số tự nhiên', 'Số nguyên', 'Phân số & Số thập phân', 'Hình học trực quan'],
  '7': ['Số hữu tỉ & Số thực', 'Thống kê & Xác suất', 'Góc & Đường thẳng song song', 'Tam giác'],
  '8': ['Đa thức & Hằng đẳng thức', 'Phân thức đại số', 'Tứ giác', 'Định lý Thalès'],
  '9': ['Căn bậc hai & Căn bậc ba', 'Hệ phương trình', 'Hàm số y=ax^2', 'Đường tròn']
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  filePreview?: {
    name: string;
    type: string;
    url?: string;
  };
}

interface Attachment {
  file: File;
  previewUrl: string;
  base64?: string;
  extractedText?: string;
}

interface TopicStats {
  count: number;
  struggles: number;
  lastPracticed: number;
}

const SYSTEM_INSTRUCTION = `Bạn là "Gia Sư Toán THCS Thông Thái" - một trợ lý AI chuyên dạy Toán cho học sinh từ lớp 6 đến lớp 9 tại Việt Nam.

MỤC TIÊU CỐT LÕI:
Giúp học sinh hiểu bản chất vấn đề, tự tư duy để tìm ra lời giải, KHÔNG BAO GIỜ làm bài hộ hoặc đưa ra đáp án ngay lập tức.

PHẠM VI KIẾN THỨC (Chương trình GDPT 2018):
- Lớp 6: Số học (Số tự nhiên, Số nguyên, Phân số/Số thập phân), Hình học trực quan.
- Lớp 7: Số hữu tỉ/thực, Thống kê cơ bản, Hình học phẳng (Góc, Tam giác bằng nhau).
- Lớp 8: Đa thức, Hằng đẳng thức, Phân thức đại số, Hình khối, Tứ giác, Định lý Thalès.
- Lớp 9: Căn bậc hai/ba, Hệ phương trình, Hàm số y=ax^2, Hình tròn, Góc với đường tròn.

NGUYÊN TẮC SƯ PHẠM (BẮT BUỘC):
1. Phương pháp Gợi mở (Socratic Method):
   - Khi học sinh hỏi một bài toán, hãy hỏi ngược lại: "Em đang vướng ở bước nào?" hoặc "Theo em, bài này thuộc dạng toán nào chúng đã học?".
   - Chia nhỏ bài toán thành các bước gợi ý (Scaffolding).
   - Chỉ cung cấp công thức hoặc định lý khi học sinh thực sự quên, nhưng không áp dụng số thay cho học sinh.

2. Chống ảo giác (Anti-Hallucination):
   - Tuyệt đối không bịa đặt công thức. Nếu không chắc chắn về một định lý nâng cao, hãy thừa nhận và hướng dẫn học sinh dùng kiến thức cơ bản.
   - Tính toán phải chính xác tuyệt đối. Hãy kiểm tra lại các bước tính toán trung gian.

3. Giao tiếp & Tương tác:
   - Giọng điệu: Thân thiện, kiên nhẫn, khuyến khích. Dùng từ ngữ phù hợp lứa tuổi teen.
   - Luôn hỏi: "Em đã hiểu đoạn này chưa?" trước khi sang bước tiếp theo.

4. Kiểm soát ngôn từ (Content Moderation):
   - Nếu học sinh sử dụng từ ngữ bậy bạ, thiếu văn hóa: Lập tức nhắc nhở nghiêm khắc nhưng chuẩn mực: "Anh/Chị/Thầy/Cô ở đây là để giúp em tiến bộ. Em vui lòng sử dụng ngôn từ lịch sự, văn minh nhé. Bây giờ chúng ta quay lại bài toán."

QUY TRÌNH XỬ LÝ:
B1: Xác định dạng toán và lớp.
B2: Khen ngợi/Ghi nhận câu hỏi.
B3: Đặt câu hỏi gợi mở đầu tiên.
B4: Dẫn dắt từng bước.
B5: Yêu cầu học sinh giải thích lại khi đã làm đúng.

LƯU Ý: Sử dụng LaTeX cho các công thức toán học (ví dụ: $x^2 + y^2 = z^2$).`;

const ApiKeyManager = ({ apiKey, apiKeyInput, setApiKeyInput, showApiKey, setShowApiKey, saveApiKey, isValidatingKey }: any) => {
  return (
    <div className="fixed top-0 left-0 w-full z-[100] bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-2 flex flex-col items-center shadow-sm">
      <div className="flex items-center justify-center gap-4 w-full">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-violet-600" />
          <span className="text-xs font-bold text-slate-600 hidden md:inline">Gemini API Key:</span>
        </div>
        <div className="relative">
          <input
            type={showApiKey ? "text" : "password"}
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="Nhập API Key..."
            className="pl-3 pr-10 py-1.5 bg-slate-100 border-none rounded-lg text-xs w-48 md:w-80 focus:ring-2 focus:ring-violet-500 transition-all font-mono"
          />
          <button
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-600 transition-colors"
          >
            {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <button
          onClick={saveApiKey}
          disabled={isValidatingKey || !apiKeyInput}
          className="bg-violet-600 text-white p-1.5 rounded-lg hover:bg-violet-700 transition-all shadow-md shadow-violet-100 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Lưu & Kiểm tra Key"
        >
          {isValidatingKey ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        </button>
      </div>
      {!apiKey && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-red-500 animate-pulse"
        >
          <AlertCircle className="w-3 h-3" />
          Vui lòng nhập API Key trước khi bắt đầu.
        </motion.div>
      )}
    </div>
  );
};

export default function App() {
  const [grade, setGrade] = useState<Grade | null>(null);
  const [mode, setMode] = useState<'chat' | 'practice' | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [topicStats, setTopicStats] = useState<Record<string, TopicStats>>({});
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<any>(null); // Kept for compatibility but unused

  // Load stats and API Key from localStorage
  useEffect(() => {
    const savedStats = localStorage.getItem('math_tutor_topic_stats');
    if (savedStats) {
      try {
        setTopicStats(JSON.parse(savedStats));
      } catch (e) {
        console.error("Failed to parse stats", e);
      }
    }

    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      setApiKeyInput(savedKey);
    }
  }, []);

  const saveApiKey = () => {
    const cleanKey = apiKeyInput.trim();
    if (!cleanKey) {
      alert("Vui lòng nhập API Key!");
      return;
    }
    
    localStorage.setItem('gemini_api_key', cleanKey);
    setApiKey(cleanKey);
    setApiKeyInput(cleanKey);
    alert("Đã lưu API Key thành công!");
  };

  // Save stats to localStorage
  useEffect(() => {
    localStorage.setItem('math_tutor_topic_stats', JSON.stringify(topicStats));
  }, [topicStats]);

  // Initialize Gemini Chat
  useEffect(() => {
    if (grade && mode && apiKey) {
      if (mode === 'chat' && messages.length === 0) {
        // Initial greeting for normal mode
        const initialMessage = `Chào em! Thầy/Cô AI rất vui được đồng hành cùng em trong môn Toán lớp ${grade}. Hôm nay có bài toán nào làm khó em không, hay em muốn ôn tập phần kiến thức nào nào? ✨`;
        setMessages([{
          role: 'assistant',
          content: initialMessage,
          timestamp: new Date()
        }]);
      }
    }
  }, [grade, mode, apiKey]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("File quá lớn. Vui lòng chọn file dưới 5MB.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    let base64 = '';
    let extractedText = '';

    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAttachment({
          file,
          previewUrl,
          base64: result.split(',')[1]
        });
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
        setAttachment({
          file,
          previewUrl,
          extractedText
        });
      } catch (err) {
        setError("Không thể đọc file Word này.");
      }
    } else {
      setError("Định dạng file không được hỗ trợ. Vui lòng chọn ảnh, PDF hoặc Word.");
    }
  };

  const removeAttachment = () => {
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
    setAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Pull fresh API key from localStorage
    const storedKey = localStorage.getItem('gemini_api_key');
    const currentKey = storedKey || apiKey;

    if ((!input.trim() && !attachment) || isLoading || !currentKey) return;

    const currentAttachment = attachment;
    const currentInput = input;

    const userMessage: Message = {
      role: 'user',
      content: currentInput || (currentAttachment ? `[Đã gửi tệp: ${currentAttachment.file.name}]` : ''),
      timestamp: new Date(),
      filePreview: currentAttachment ? {
        name: currentAttachment.file.name,
        type: currentAttachment.file.type,
        url: currentAttachment.file.type.startsWith('image/') ? currentAttachment.previewUrl : undefined
      } : undefined
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    removeAttachment();
    setIsLoading(true);
    setError(null);

    try {
      // Build history for API
      const historyContents = newMessages.map(msg => {
        const parts: any[] = [];
        if (msg.filePreview && msg.filePreview.type.startsWith('image/')) {
           parts.push({ text: msg.content });
        } else {
           parts.push({ text: msg.content });
        }
        return {
          role: msg.role === 'user' ? 'user' : 'model',
          parts: parts
        };
      });

      if (currentAttachment && currentAttachment.base64) {
        const lastMsgIndex = historyContents.length - 1;
        historyContents[lastMsgIndex].parts = [
          { text: currentInput || "Hãy xem tệp đính kèm này." },
          {
            inlineData: {
              mimeType: currentAttachment.file.type,
              data: currentAttachment.base64
            }
          }
        ];
      } else if (currentAttachment && currentAttachment.extractedText) {
         const lastMsgIndex = historyContents.length - 1;
         historyContents[lastMsgIndex].parts = [
           { text: `Nội dung từ tệp Word (${currentAttachment.file.name}):\n${currentAttachment.extractedText}\n\nCâu hỏi của mình: ${currentInput || "Hãy giải bài toán này."}` }
         ];
      }

      // Build system instruction with context
      const struggleTopics = Object.entries(topicStats)
        .filter(([_, stat]) => stat.struggles > 2)
        .map(([topic]) => topic);
      
      const personalizationContext = struggleTopics.length > 0 
        ? `\n\nLƯU Ý CÁ NHÂN HÓA: Học sinh này đang gặp khó khăn với các chủ đề: ${struggleTopics.join(', ')}. Hãy kiên nhẫn hơn và đưa ra nhiều ví dụ minh họa hơn cho các phần này.`
        : '';
      
      const fullSystemInstruction = `${SYSTEM_INSTRUCTION}\n\nHiện tại, em đang hỗ trợ học sinh lớp ${grade}. ${mode === 'practice' ? 'Học sinh đang ở chế độ TỰ LUYỆN TẬP. Hãy đưa ra các bài toán phù hợp với chủ đề học sinh chọn và dẫn dắt em giải quyết.' : ''}${personalizationContext}`;

      const data = await callGeminiAPI(historyContents, fullSystemInstruction, currentKey);
      
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Simple struggle detection logic
      if (currentTopic) {
        const struggleKeywords = ['chưa chính xác', 'thử lại', 'nhầm lẫn', 'sai rồi', 'cần xem lại'];
        const isStruggling = struggleKeywords.some(kw => responseText.toLowerCase().includes(kw));
        
        if (isStruggling) {
          setTopicStats(prev => ({
            ...prev,
            [currentTopic]: {
              ...prev[currentTopic] || { count: 0, struggles: 0, lastPracticed: Date.now() },
              struggles: (prev[currentTopic]?.struggles || 0) + 1
            }
          }));
        }
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: responseText || 'Xin lỗi, thầy/cô gặp chút trục tặc. Em thử lại nhé!',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error("Gemini API Error:", err);
      const errorMessage = err.message || "Unknown error";
      alert("Google API Error: " + errorMessage);
      setError(`Có lỗi xảy ra: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    setGrade(null);
    setMode(null);
    setMessages([]);
    setCurrentTopic(null);
    // chatRef.current = null; // No longer needed
  };

  const startPractice = (topic: string) => {
    setCurrentTopic(topic);
    setTopicStats(prev => ({
      ...prev,
      [topic]: {
        ...prev[topic] || { count: 0, struggles: 0, lastPracticed: Date.now() },
        count: (prev[topic]?.count || 0) + 1,
        lastPracticed: Date.now()
      }
    }));

    const initialMessage = `Tuyệt vời! Chúng ta sẽ cùng luyện tập chủ đề **${topic}** nhé. Thầy/Cô sẽ đưa ra một bài toán để em thử sức. Sẵn sàng chưa nào?`;
    setMessages([{
      role: 'assistant',
      content: initialMessage,
      timestamp: new Date()
    }]);
    
    // Trigger AI to generate the first problem
    handleSendMessageDirectly(`Mình muốn luyện tập chủ đề "${topic}". Hãy đưa ra cho mình một bài toán cơ bản để bắt đầu nhé.`);
  };

  const handleSendMessageDirectly = async (text: string) => {
    // Pull fresh API key from localStorage
    const storedKey = localStorage.getItem('gemini_api_key');
    const currentKey = storedKey || apiKey;
    
    if (!currentKey) return;

    setIsLoading(true);
    setError(null);
    try {
      // Build history including the new message
      const historyContents = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));
      
      // Add the new message
      historyContents.push({
        role: 'user',
        parts: [{ text: text }]
      });

      // Build system instruction
      const struggleTopics = Object.entries(topicStats)
        .filter(([_, stat]) => stat.struggles > 2)
        .map(([topic]) => topic);
      
      const personalizationContext = struggleTopics.length > 0 
        ? `\n\nLƯU Ý CÁ NHÂN HÓA: Học sinh này đang gặp khó khăn với các chủ đề: ${struggleTopics.join(', ')}. Hãy kiên nhẫn hơn và đưa ra nhiều ví dụ minh họa hơn cho các phần này.`
        : '';
      
      const fullSystemInstruction = `${SYSTEM_INSTRUCTION}\n\nHiện tại, em đang hỗ trợ học sinh lớp ${grade}. ${mode === 'practice' ? 'Học sinh đang ở chế độ TỰ LUYỆN TẬP. Hãy đưa ra các bài toán phù hợp với chủ đề học sinh chọn và dẫn dắt em giải quyết.' : ''}${personalizationContext}`;

      const data = await callGeminiAPI(historyContents, fullSystemInstruction, currentKey);
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      const assistantMessage: Message = {
        role: 'assistant',
        content: responseText || 'Xin lỗi, thầy/cô gặp chút trục tặc. Em thử lại nhé!',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error("Gemini API Error:", err);
      const errorMessage = err.message || "Unknown error";
      alert("Google API Error: " + errorMessage);
      setError(`Có lỗi xảy ra: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!grade) {
    return (
      <div className="fixed inset-0 flex flex-col w-full h-full bg-slate-50 items-center justify-center p-4 pt-16 overflow-hidden">
        <ApiKeyManager 
          apiKey={apiKey}
          apiKeyInput={apiKeyInput} 
          setApiKeyInput={setApiKeyInput} 
          showApiKey={showApiKey} 
          setShowApiKey={setShowApiKey} 
          saveApiKey={saveApiKey} 
          isValidatingKey={isValidatingKey}
        />
        {/* Background Decorations */}
        <div className="absolute inset-0 ai-glow-1 pointer-events-none" />
        <div className="absolute inset-0 ai-glow-2 pointer-events-none" />
        <div className="absolute inset-0 ai-glow-3 pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl w-full glass-card rounded-[3rem] p-8 md:p-12 relative z-10"
        >
          <div className="flex flex-col items-center mb-10">
            <motion.div 
              animate={{ 
                rotate: [0, 10, -10, 0],
                scale: [1, 1.05, 0.95, 1]
              }}
              transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
              className="w-24 h-24 bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl shadow-indigo-300 animate-float"
            >
              <BrainCircuit className="text-white w-14 h-14" />
            </motion.div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-center uppercase ai-gradient-text whitespace-nowrap">
              Học toán không khó
            </h1>
            <p className="text-slate-500 text-center mt-4 text-lg font-semibold">Thầy/cô giáo AI rất giỏi về môn Toán đồng hành cùng em</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {(['6', '7', '8', '9'] as Grade[]).map((g, idx) => (
              <motion.button
                key={g}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => setGrade(g)}
                className="group relative flex flex-col items-center justify-center p-4 bg-white/50 hover:bg-gradient-to-br hover:from-violet-600 hover:to-indigo-600 rounded-[1.5rem] border border-white shadow-sm hover:shadow-2xl hover:shadow-indigo-300 transition-all duration-500 cursor-pointer overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-20 transition-opacity">
                  <Zap className="w-10 h-10 text-white" />
                </div>
                <span className="text-[9px] font-black text-slate-400 group-hover:text-indigo-100 uppercase tracking-[0.2em] mb-1">Khối</span>
                <span className="text-2xl font-normal text-violet-600 group-hover:text-violet-400 transition-colors uppercase">Lớp {g}</span>
                <div className="mt-3 w-7 h-7 bg-white group-hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors shadow-sm">
                  <ArrowRight className="w-4 h-4 text-violet-600 group-hover:text-white" />
                </div>
              </motion.button>
            ))}
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-10 flex items-start gap-4 p-5 bg-violet-50/50 rounded-2xl border border-violet-100/50"
          >
            <Sparkles className="w-6 h-6 text-violet-600 flex-none mt-0.5" />
            <p className="text-sm text-violet-800 leading-relaxed font-medium">
              Thầy/Cô AI sẽ không giải bài hộ, mà sẽ hướng dẫn em từng bước để em tự làm chủ kiến thức. Cùng bắt đầu nhé!
            </p>
          </motion.div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="absolute bottom-6 text-center z-10"
        >
          <p className="text-[11px] font-medium text-blue-900">
            © 2026 Gia sư hỗ trợ học Toán AI. Được hỗ trợ bởi Gemini AI.
          </p>
        </motion.div>
      </div>
    );
  }

  if (grade && !mode) {
    return (
      <div className="fixed inset-0 flex flex-col w-full h-full bg-slate-50 items-center justify-center p-4 pt-16 overflow-hidden">
        <ApiKeyManager 
          apiKey={apiKey}
          apiKeyInput={apiKeyInput} 
          setApiKeyInput={setApiKeyInput} 
          showApiKey={showApiKey} 
          setShowApiKey={setShowApiKey} 
          saveApiKey={saveApiKey} 
          isValidatingKey={isValidatingKey}
        />
        <div className="absolute inset-0 ai-glow-1 pointer-events-none opacity-50" />
        <div className="absolute inset-0 ai-glow-2 pointer-events-none opacity-50" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full glass-card rounded-[3rem] p-8 md:p-12 relative z-10"
        >
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 ai-gradient-text whitespace-nowrap">Thầy/cô chào em học sinh ham học</h2>
            <p className="text-slate-500 mt-3 font-semibold text-lg">Hôm nay em muốn học theo cách nào?</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.button
              whileHover={{ y: -4, scale: 1.01 }}
              onClick={() => setMode('chat')}
              className="flex flex-col items-center p-5 bg-white/60 rounded-[1.5rem] border border-white shadow-sm hover:shadow-2xl hover:shadow-violet-200 transition-all group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-violet-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-14 h-14 bg-violet-100 text-violet-600 rounded-[1rem] flex items-center justify-center mb-3 group-hover:bg-violet-600 group-hover:text-white transition-all duration-500 shadow-lg relative z-10">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900 relative z-10">Hỏi đáp bài tập</h3>
              <p className="text-[11px] text-slate-500 text-center mt-1 font-medium relative z-10">Giải đáp thắc mắc, hướng dẫn làm bài tập về nhà</p>
            </motion.button>

            <motion.button
              whileHover={{ y: -4, scale: 1.01 }}
              onClick={() => setMode('practice')}
              className="flex flex-col items-center p-5 bg-white/60 rounded-[1.5rem] border border-white shadow-sm hover:shadow-2xl hover:shadow-amber-200 transition-all group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-[1rem] flex items-center justify-center mb-3 group-hover:bg-amber-600 group-hover:text-white transition-all duration-500 shadow-lg relative z-10">
                <Dumbbell className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900 relative z-10">Tự luyện tập</h3>
              <p className="text-[11px] text-slate-500 text-center mt-1 font-medium relative z-10">Luyện tập theo chủ đề, thử thách bản thân</p>
            </motion.button>
          </div>

          <button 
            onClick={() => setGrade(null)}
            className="mt-8 w-full text-slate-400 font-bold hover:text-slate-600 transition-colors"
          >
            Quay lại chọn khối lớp
          </button>
        </motion.div>
      </div>
    );
  }

  if (mode === 'practice' && messages.length === 0) {
    const gradeTopics = TOPICS[grade!];
    const suggestedTopics = gradeTopics
      .map(topic => ({
        topic,
        score: (topicStats[topic]?.struggles || 0) * 2 + (topicStats[topic]?.count || 0)
      }))
      .sort((a, b) => b.score - a.score)
      .filter(t => t.score > 0)
      .slice(0, 2);

    return (
      <div className="fixed inset-0 flex flex-col w-full h-full bg-slate-50 items-center justify-center p-4 pt-16 overflow-hidden">
        <ApiKeyManager 
          apiKey={apiKey}
          apiKeyInput={apiKeyInput} 
          setApiKeyInput={setApiKeyInput} 
          showApiKey={showApiKey} 
          setShowApiKey={setShowApiKey} 
          saveApiKey={saveApiKey} 
          isValidatingKey={isValidatingKey}
        />
        <div className="absolute inset-0 ai-glow-1 pointer-events-none opacity-50" />
        <div className="absolute inset-0 ai-glow-3 pointer-events-none opacity-50" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-3xl w-full bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl p-8 md:p-10 border border-white/50 relative z-10 overflow-y-auto max-h-[90vh]"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-100">
              <Target className="text-white w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">Chọn chủ đề luyện tập</h2>
              <p className="text-slate-500 font-medium">Lớp {grade} • Thử thách bản thân ngay!</p>
            </div>
          </div>

          {suggestedTopics.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-violet-600" />
                <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Gợi ý cho em</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {suggestedTopics.map((t) => (
                  <button
                    key={t.topic}
                    onClick={() => startPractice(t.topic)}
                    className="flex items-center gap-4 p-5 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 text-left group transition-transform hover:scale-[1.02]"
                  >
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-none">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <span className="font-bold text-white block">{t.topic}</span>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-indigo-100 font-bold uppercase tracking-widest flex items-center gap-1">
                          <Trophy className="w-3 h-3" /> {topicStats[t.topic]?.count || 0} lần
                        </span>
                        <span className="text-[10px] text-indigo-100 font-bold uppercase tracking-widest flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {topicStats[t.topic]?.struggles || 0} lỗi
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-slate-400" />
            <h3 className="font-bold text-slate-400 uppercase tracking-wider text-sm">Tất cả chủ đề</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {gradeTopics.map((topic, idx) => (
              <motion.button
                key={topic}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => startPractice(topic)}
                className="flex items-center gap-4 p-5 bg-white hover:bg-slate-50 rounded-2xl border border-slate-100 hover:border-violet-200 shadow-sm hover:shadow-md transition-all text-left group"
              >
                <div className="w-10 h-10 bg-slate-50 group-hover:bg-white rounded-xl flex items-center justify-center flex-none transition-colors">
                  <BookOpen className="w-5 h-5 text-slate-400 group-hover:text-violet-600" />
                </div>
                <div className="flex-1">
                  <span className="font-bold text-slate-700 group-hover:text-slate-900 block">{topic}</span>
                  {topicStats[topic] && (
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                        <Trophy className="w-3 h-3" /> {topicStats[topic].count} lần
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {topicStats[topic].struggles} lỗi
                      </span>
                    </div>
                  )}
                </div>
              </motion.button>
            ))}
          </div>

          <button 
            onClick={() => setMode(null)}
            className="mt-8 w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            Quay lại chọn chế độ
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col w-full h-full bg-slate-50 pt-12 overflow-hidden">
      <ApiKeyManager 
        apiKey={apiKey}
        apiKeyInput={apiKeyInput} 
        setApiKeyInput={setApiKeyInput} 
        showApiKey={showApiKey} 
        setShowApiKey={setShowApiKey} 
        saveApiKey={saveApiKey} 
        isValidatingKey={isValidatingKey}
      />
      <div className="absolute inset-0 ai-glow-1 pointer-events-none opacity-50" />
      <div className="absolute inset-0 ai-glow-2 pointer-events-none opacity-50" />

      {/* Header */}
      <header className="flex-none bg-white/60 backdrop-blur-xl border-b border-white/40 px-6 py-5 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 rounded-[1.25rem] flex items-center justify-center shadow-xl shadow-indigo-200 animate-float">
              <BrainCircuit className="text-white w-8 h-8" />
            </div>
            <div>
              <h2 className="font-black text-slate-900 text-xl leading-none flex items-center gap-3">
                Toán Lớp {grade}
                <span className="px-3 py-1 bg-violet-100 text-violet-600 text-[10px] font-black rounded-full uppercase tracking-[0.2em] shadow-sm">AI Tutor</span>
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <div className="relative flex items-center justify-center">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                  <div className="absolute w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping opacity-75" />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Hệ thống thông minh sẵn sàng</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowGuide(true)}
              className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all font-semibold text-sm border border-transparent hover:border-indigo-100"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Hướng dẫn</span>
            </button>
            {mode === 'chat' && messages.length > 0 && (
              <button 
                onClick={() => {
                  setMode('practice');
                  setMessages([]);
                  chatRef.current = null;
                }}
                className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl transition-all font-bold text-sm border border-amber-100"
              >
                <Dumbbell className="w-4 h-4" />
                <span>Tự luyện tập</span>
              </button>
            )}
            {mode === 'practice' && messages.length > 0 && (
              <button 
                onClick={() => {
                  setMode('chat');
                  setMessages([]);
                  chatRef.current = null;
                }}
                className="flex items-center gap-2 px-4 py-2 bg-violet-50 text-violet-600 hover:bg-violet-100 rounded-xl transition-all font-bold text-sm border border-violet-100"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Hỏi đáp bài tập</span>
              </button>
            )}
            <button 
              onClick={resetChat}
              className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-all font-semibold text-sm border border-transparent hover:border-violet-100"
            >
              <RefreshCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Đổi lớp</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-8 space-y-10 relative z-10 custom-scrollbar"
      >
        <div className="max-w-4xl mx-auto space-y-10">
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={cn(
                  "flex gap-5",
                  msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center flex-none shadow-xl transition-all duration-300 hover:scale-110",
                  msg.role === 'user' 
                    ? "bg-gradient-to-br from-slate-700 to-slate-900 text-white" 
                    : "bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 text-white shadow-indigo-200"
                )}>
                  {msg.role === 'user' ? <User className="w-7 h-7" /> : <BrainCircuit className="w-7 h-7" />}
                </div>
                
                <div className={cn(
                  "max-w-[85%] md:max-w-[80%] p-6 md:p-8 rounded-[2.5rem] shadow-sm relative group overflow-hidden",
                  msg.role === 'user' 
                    ? "bg-white text-slate-800 rounded-tr-none border border-slate-100" 
                    : "glass-card text-slate-800 rounded-tl-none border-violet-100/50"
                )}>
                  {msg.role === 'assistant' && (
                    <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                      <Sparkles className="w-16 h-16 text-violet-600" />
                    </div>
                  )}
                  {msg.filePreview && (
                    <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-5">
                      {msg.filePreview.url ? (
                        <img src={msg.filePreview.url} alt="preview" className="w-20 h-20 object-cover rounded-xl border border-slate-200 shadow-sm" />
                      ) : (
                        <div className="w-20 h-20 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100">
                          <FileText className="w-10 h-10 text-indigo-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black truncate text-slate-700 uppercase tracking-wider">{msg.filePreview.name}</p>
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mt-1">{msg.filePreview.type.split('/')[1]}</p>
                      </div>
                    </div>
                  )}
                  <div className="markdown-body prose prose-slate max-w-none prose-p:leading-relaxed prose-strong:text-violet-600 prose-code:bg-slate-100 prose-code:text-violet-600 prose-code:rounded prose-code:px-1">
                    <Markdown 
                      remarkPlugins={[remarkMath]} 
                      rehypePlugins={[rehypeKatex]}
                    >
                      {msg.content}
                    </Markdown>
                  </div>
                  <div className={cn(
                    "text-[10px] mt-4 font-black text-slate-300 uppercase tracking-[0.2em]",
                    msg.role === 'user' ? "text-right" : "text-left"
                  )}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex gap-5"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 flex items-center justify-center flex-none shadow-xl shadow-indigo-200">
                <Sparkles className="w-7 h-7 text-white animate-pulse" />
              </div>
              <div className="glass-card p-6 rounded-[2rem] rounded-tl-none flex gap-2 items-center">
                <div className="w-2.5 h-2.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2.5 h-2.5 bg-violet-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2.5 h-2.5 bg-violet-600 rounded-full animate-bounce" />
              </div>
            </motion.div>
          )}

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex justify-center"
            >
              <div className="bg-red-50 text-red-600 px-6 py-3 rounded-2xl text-sm font-bold border border-red-100 flex items-center gap-3 shadow-sm">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Footer / Input Area */}
      <footer className="flex-none bg-white/60 backdrop-blur-xl border-t border-white/40 p-6 z-20">
        <div className="max-w-5xl mx-auto">
          <AnimatePresence>
            {attachment && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mb-4 flex items-center gap-4 p-4 bg-white rounded-[2rem] border border-violet-100 shadow-xl shadow-violet-500/5"
              >
                <div className="relative">
                  {attachment.file.type.startsWith('image/') ? (
                    <img src={attachment.previewUrl} alt="preview" className="w-16 h-16 object-cover rounded-2xl border border-slate-100 shadow-sm" />
                  ) : (
                    <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center border border-violet-100">
                      {attachment.file.type === 'application/pdf' ? <FileText className="text-violet-600 w-8 h-8" /> : <BookOpen className="text-violet-600 w-8 h-8" />}
                    </div>
                  )}
                  <button 
                    onClick={removeAttachment}
                    className="absolute -top-2 -right-2 bg-slate-900 text-white rounded-full p-1.5 shadow-lg hover:bg-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 truncate">{attachment.file.name}</p>
                  <p className="text-[10px] font-black text-violet-400 uppercase tracking-[0.2em] mt-1">{(attachment.file.size / 1024).toFixed(1)} KB • {attachment.file.type.split('/')[1]}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form 
            onSubmit={handleSendMessage}
            className="relative flex items-center gap-4"
          >
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,.pdf,.docx"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-[1.5rem] transition-all border border-transparent hover:border-violet-100 group shadow-sm bg-white"
              title="Đính kèm file (Ảnh, PDF, Word)"
            >
              <Paperclip className="w-7 h-7 group-hover:rotate-12 transition-transform" />
            </button>
            <div className="flex-1 relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 rounded-[2rem] blur opacity-10 group-focus-within:opacity-25 transition duration-500" />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={apiKey ? "Nhập câu hỏi hoặc đính kèm bài tập..." : "Vui lòng nhập API Key Gemini của bạn ở góc trên để bắt đầu sử dụng Gia sư"}
                className={cn(
                  "w-full relative bg-white border border-slate-100 rounded-[2rem] px-8 py-5 pr-20 focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all text-base font-semibold shadow-xl shadow-indigo-500/5 placeholder:text-slate-400",
                  !apiKey && "opacity-50 cursor-not-allowed"
                )}
                disabled={isLoading || !apiKey}
              />
              <button
                type="submit"
                disabled={(!input.trim() && !attachment) || isLoading || !apiKey}
                className={cn(
                  "absolute right-2.5 top-1/2 -translate-y-1/2 p-3.5 rounded-[1.25rem] transition-all duration-300 shadow-lg",
                  (!input.trim() && !attachment) || isLoading
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "ai-button-primary"
                )}
              >
                {isLoading ? (
                  <RefreshCcw className="w-6 h-6 animate-spin" />
                ) : (
                  <Send className="w-6 h-6" />
                )}
              </button>
            </div>
          </form>
          
          <div className="flex items-center justify-center gap-8 mt-4 text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">
            <div className="flex items-center gap-2 group cursor-default">
              <Cpu className="w-3.5 h-3.5 group-hover:text-violet-500 transition-colors" />
              <span>AI Engine</span>
            </div>
            <div className="flex items-center gap-2 group cursor-default">
              <Layers className="w-3.5 h-3.5 group-hover:text-cyan-500 transition-colors" />
              <span>Bản chất</span>
            </div>
            <div className="flex items-center gap-2 group cursor-default">
              <Zap className="w-3.5 h-3.5 group-hover:text-amber-500 transition-colors" />
              <span>Gợi mở</span>
            </div>
          </div>
        </div>
      </footer>

      {/* User Guide Modal */}
      <AnimatePresence>
        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGuide(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-violet-50 to-indigo-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-200">
                    <Info className="text-white w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">Hướng dẫn sử dụng</h3>
                </div>
                <button 
                  onClick={() => setShowGuide(false)}
                  className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-slate-800 text-lg">1. Chế độ Hỏi đáp bài tập</h4>
                  </div>
                  <p className="text-slate-600 leading-relaxed mb-4">
                    Đây là nơi em có thể hỏi bất kỳ bài toán nào đang làm khó mình. Thầy/Cô AI sẽ không giải hộ ngay mà sẽ:
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3 text-sm text-slate-600">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-none mt-0.5" />
                      <span>Gợi ý các kiến thức liên quan để em nhớ lại.</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-slate-600">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-none mt-0.5" />
                      <span>Đặt câu hỏi dẫn dắt để em tự tìm ra bước tiếp theo.</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-slate-600">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-none mt-0.5" />
                      <span>Kiểm tra và khen ngợi khi em làm đúng từng bước.</span>
                    </li>
                  </ul>
                </section>

                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                      <Dumbbell className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-slate-800 text-lg">2. Chế độ Tự luyện tập</h4>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Em có thể chọn một chủ đề cụ thể (như Số nguyên, Hình học...) để AI đưa ra các bài toán thử thách. Đây là cách tốt nhất để ôn tập và củng cố kiến thức trước các kỳ kiểm tra.
                  </p>
                </section>

                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center">
                      <Paperclip className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-slate-800 text-lg">3. Đính kèm tệp tin</h4>
                  </div>
                  <p className="text-slate-600 leading-relaxed mb-4">
                    Em không cần phải gõ lại đề bài dài dòng! Hãy sử dụng nút đính kèm để gửi:
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                      <ImageIcon className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Hình ảnh</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                      <FileText className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase">File PDF</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                      <BookOpen className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase">File Word</span>
                    </div>
                  </div>
                </section>

                <div className="p-6 bg-indigo-600 rounded-3xl text-white">
                  <div className="flex items-center gap-3 mb-3">
                    <Lightbulb className="w-6 h-6 text-amber-300" />
                    <h4 className="font-bold text-lg">Mẹo nhỏ để học tốt hơn</h4>
                  </div>
                  <ul className="space-y-3 text-sm opacity-90">
                    <li>• Hãy nói cho AI biết em đang vướng ở bước nào.</li>
                    <li>• Đừng ngần ngại hỏi "Tại sao?" nếu em chưa hiểu bản chất.</li>
                    <li>• Chụp ảnh bài làm của em để AI kiểm tra giúp nhé!</li>
                  </ul>
                </div>

                {Object.keys(topicStats).length > 0 && (
                  <section className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <div className="flex items-center gap-3 mb-4">
                      <Trophy className="w-6 h-6 text-amber-500" />
                      <h4 className="font-bold text-slate-800 text-lg">Tiến độ của em</h4>
                    </div>
                    <div className="space-y-4">
                      {Object.entries(topicStats)
                        .sort((a, b) => b[1].lastPracticed - a[1].lastPracticed)
                        .slice(0, 3)
                        .map(([topic, stat]) => (
                          <div key={topic} className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-bold text-slate-700">{topic}</p>
                              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full transition-all duration-1000",
                                    stat.struggles > 2 ? "bg-amber-500" : "bg-emerald-500"
                                  )}
                                  style={{ width: `${Math.min(100, (stat.count * 20))}%` }}
                                />
                              </div>
                            </div>
                            <div className="ml-4 text-right">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {stat.struggles > 2 ? 'Cần cố gắng' : 'Hoàn thành tốt'}
                              </p>
                              <p className="text-xs font-bold text-slate-600">{stat.count} lần luyện</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </section>
                )}
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50">
                <button 
                  onClick={() => setShowGuide(false)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                >
                  Đã hiểu, bắt đầu học thôi!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
