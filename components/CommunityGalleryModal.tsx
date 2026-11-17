import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Search, Heart, Eye, Sparkles, Play, Pause, Flame, Star, Film, Image as ImageIcon, 
  User as UserIcon, LogIn, LogOut, ExternalLink, Share2, Copy, Check, Trash2, ArrowUpRight, 
  RotateCcw, Tag, Compass, Plus, Layers, Sliders, Download, Lock, Unlock, AlertTriangle, ShieldCheck, Edit2
} from 'lucide-react';
import { User, db, collection, doc, setDoc, getDocs, getDoc, updateDoc, deleteDoc, query, where, orderBy, limit, Timestamp } from '../src/lib/firebase';
import { SteamIcon } from './SteamIcon';
import { GithubIcon } from './GithubIcon';
import { XIcon } from './XIcon';
import { GridState, ProjectType, Project, ExtendedUser } from '../types';
import { Language } from '../src/l10n';
import { Toaster, toast } from 'sonner';

export interface CommunityPost {
  id: string;
  title: string;
  description?: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorProvider?: string;
  previewImage?: string;
  grid: string; // JSON string of GridState
  frames?: string[]; // JSON strings of GridState frames
  width: number;
  height: number;
  fps: number;
  projectType: ProjectType;
  likesCount: number;
  viewsCount: number;
  allowDownload?: boolean; // License permission
  tags: string[];
  createdAt: any;
  updatedAt?: any;
}

interface CommunityGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: ExtendedUser | null;
  savedProjects: Project[];
  currentActiveProject?: Project | null;
  language: Language;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

// Helper to determine the user's active login provider
const getUserProvider = (u: ExtendedUser | null): string => {
  if (!u) return '';
  if (u.provider) return u.provider;
  if (u.steamId) return 'steam';
  if (u.githubId) return 'github';
  if (u.xId) return 'x';
  if (u.providerData && u.providerData.length > 0) {
    const pId = u.providerData[0].providerId.toLowerCase();
    if (pId.includes('google')) return 'google';
    if (pId.includes('github')) return 'github';
    if (pId.includes('twitter') || pId.includes('x')) return 'x';
    if (pId.includes('steam')) return 'steam';
    return 'email';
  }
  return '';
};

// Helper to render provider icon (X, Steam, Google, GitHub) - Returns null for regular email/password
const ProviderBadge: React.FC<{ provider?: string }> = ({ provider }) => {
  if (!provider) return null;
  const p = provider.toLowerCase();
  if (p === 'email' || p === 'password' || p === 'guest' || p === 'anonymous') {
    return null;
  }
  if (p.includes('github')) {
    return <span title="GitHub" className="p-0.5 rounded-md bg-[#24292e] text-white inline-flex items-center justify-center shrink-0"><GithubIcon className="w-3 h-3" /></span>;
  }
  if (p.includes('steam')) {
    return <span title="Steam" className="p-0.5 rounded-md bg-[#171a21] text-[#66c0f4] inline-flex items-center justify-center shrink-0"><SteamIcon className="w-3 h-3" /></span>;
  }
  if (p.includes('twitter') || p.includes('x')) {
    return <span title="X" className="p-0.5 rounded-md bg-black text-white inline-flex items-center justify-center shrink-0"><XIcon className="w-3 h-3" /></span>;
  }
  if (p.includes('google')) {
    return (
      <span title="Google" className="px-1 py-0.5 rounded-md bg-white/10 text-indigo-400 font-bold text-[10px] leading-none inline-flex items-center justify-center shrink-0">
        G
      </span>
    );
  }
  return null;
};

export const CommunityGalleryModal: React.FC<CommunityGalleryModalProps> = ({
  isOpen,
  onClose,
  user,
  savedProjects,
  currentActiveProject,
  language,
  onOpenAuth,
  onLogout
}) => {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'popular' | 'latest' | 'animated' | 'static' | 'my'>('popular');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [userLikes, setUserLikes] = useState<Record<string, boolean>>({});
  
  // Available projects to publish (Saved projects + currently active canvas project if present)
  const availableProjectsToPublish = useMemo(() => {
    const list = [...savedProjects];
    if (currentActiveProject && !list.some(p => p.id === currentActiveProject.id)) {
      list.unshift(currentActiveProject);
    }
    return list;
  }, [savedProjects, currentActiveProject]);
  
  // Inspect Modal State
  const [inspectPost, setInspectPost] = useState<CommunityPost | null>(null);
  const [inspectPlaying, setInspectPlaying] = useState(true);
  const [inspectFrameIndex, setInspectFrameIndex] = useState(0);

  // Publish Modal State
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [selectedProjectToPublish, setSelectedProjectToPublish] = useState<Project | null>(null);
  const [publishTitle, setPublishTitle] = useState('');
  const [publishDescription, setPublishDescription] = useState('');
  const [publishTags, setPublishTags] = useState('');
  const [allowDownload, setAllowDownload] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);

  // Edit Post Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAllowDownload, setEditAllowDownload] = useState(true);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete Post Confirmation State
  const [postToDelete, setPostToDelete] = useState<CommunityPost | null>(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);

  // Load Real Posts from Firestore (No hardcoded/seeded fake posts)
  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const postsRef = collection(db, 'community_posts');
      const q = query(postsRef, orderBy('createdAt', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      
      let fetched: CommunityPost[] = [];
      if (!snapshot.empty) {
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          fetched.push({
            id: docSnap.id,
            ...data
          } as CommunityPost);
        });
      }

      setPosts(fetched);

      // Fetch user likes if logged in
      if (user) {
        const likesMap: Record<string, boolean> = {};
        for (const post of fetched) {
          try {
            const likeDoc = await getDoc(doc(db, 'community_posts', post.id, 'likes', user.uid));
            if (likeDoc.exists()) {
              likesMap[post.id] = true;
            }
          } catch (e) {}
        }
        setUserLikes(likesMap);
      }
    } catch (err) {
      console.error('Failed to fetch community posts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPosts();
    }
  }, [isOpen, user?.uid]);

  // Handle Like Toggle
  const handleToggleLike = async (post: CommunityPost, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user) {
      toast.error(
        language === 'en'
          ? 'Sign in to like community artworks!'
          : 'Войдите в аккаунт, чтобы ставить лайки!'
      );
      return;
    }

    const isLiked = Boolean(userLikes[post.id]);
    const nextLiked = !isLiked;
    const diff = nextLiked ? 1 : -1;

    // Optimistic UI update
    setUserLikes(prev => ({ ...prev, [post.id]: nextLiked }));
    setPosts(prev =>
      prev.map(p => (p.id === post.id ? { ...p, likesCount: Math.max(0, p.likesCount + diff) } : p))
    );
    if (inspectPost && inspectPost.id === post.id) {
      setInspectPost(prev => prev ? { ...prev, likesCount: Math.max(0, prev.likesCount + diff) } : null);
    }

    try {
      const likeRef = doc(db, 'community_posts', post.id, 'likes', user.uid);
      const postRef = doc(db, 'community_posts', post.id);

      if (nextLiked) {
        await setDoc(likeRef, { userId: user.uid, createdAt: Timestamp.now() });
        await updateDoc(postRef, { likesCount: post.likesCount + 1, updatedAt: Timestamp.now() });
      } else {
        await deleteDoc(likeRef);
        await updateDoc(postRef, { likesCount: Math.max(0, post.likesCount - 1), updatedAt: Timestamp.now() });
      }
    } catch (err) {
      console.error('Failed to update like:', err);
      setUserLikes(prev => ({ ...prev, [post.id]: isLiked }));
      setPosts(prev =>
        prev.map(p => (p.id === post.id ? { ...p, likesCount: post.likesCount } : p))
      );
    }
  };

  // Handle Inspect Modal Open & Deduplicated Views Count
  const handleOpenInspect = async (post: CommunityPost) => {
    setInspectPost(post);
    setInspectFrameIndex(0);
    setInspectPlaying(true);

    const viewerId = user?.uid || 'guest_session';
    const viewStorageKey = `novablast_viewed_post_${post.id}_${viewerId}`;

    if (localStorage.getItem(viewStorageKey)) {
      // User/session has already viewed this artwork card, do not increment view counter
      return;
    }

    try {
      localStorage.setItem(viewStorageKey, 'true');
      const postRef = doc(db, 'community_posts', post.id);
      await updateDoc(postRef, { viewsCount: (post.viewsCount || 0) + 1 });
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, viewsCount: (p.viewsCount || 0) + 1 } : p));
    } catch (e) {
      console.warn('Failed to increment views count:', e);
    }
  };

  // Edit Modal Handlers for Author/Admin
  const handleOpenEditModal = (post: CommunityPost, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user || (user.uid !== post.authorId && user.email !== 'zuravlevm379@gmail.com')) {
      toast.error(language === 'en' ? 'You can only edit your own publications!' : 'Вы можете редактировать только свои публикации!');
      return;
    }
    setEditingPost(post);
    setEditTitle(post.title || '');
    setEditDescription(post.description || '');
    setEditAllowDownload(post.allowDownload !== false);
    setIsEditModalOpen(true);
  };

  const handleSaveEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost || !user) return;

    const trimmedTitle = editTitle.trim() || editingPost.title;
    const trimmedDesc = editDescription.trim();

    setIsSavingEdit(true);
    try {
      const postRef = doc(db, 'community_posts', editingPost.id);
      await updateDoc(postRef, {
        title: trimmedTitle,
        description: trimmedDesc,
        allowDownload: editAllowDownload,
        updatedAt: Timestamp.now()
      });

      setPosts(prev => prev.map(p => p.id === editingPost.id ? {
        ...p,
        title: trimmedTitle,
        description: trimmedDesc,
        allowDownload: editAllowDownload
      } : p));

      if (inspectPost && inspectPost.id === editingPost.id) {
        setInspectPost(prev => prev ? {
          ...prev,
          title: trimmedTitle,
          description: trimmedDesc,
          allowDownload: editAllowDownload
        } : null);
      }

      toast.success(
        language === 'en' ? 'Publication updated!' : 'Публикация успешно обновлена!'
      );
      setIsEditModalOpen(false);
      setEditingPost(null);
    } catch (err: any) {
      console.error('Failed to update publication:', err);
      toast.error(
        language === 'en' ? 'Failed to update publication' : 'Не удалось обновить публикацию'
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Animation Loop inside Inspect Modal
  useEffect(() => {
    if (!inspectPost || inspectPost.projectType !== 'animated' || !inspectPlaying) return;
    let parsedFrames: GridState[] = [];
    try {
      if (inspectPost.frames && inspectPost.frames.length > 0) {
        parsedFrames = inspectPost.frames.map(f => typeof f === 'string' ? JSON.parse(f) : f);
      }
    } catch (e) {}

    if (parsedFrames.length <= 1) return;

    const interval = 1000 / (inspectPost.fps || 8);
    const timer = setInterval(() => {
      setInspectFrameIndex(prev => (prev + 1) % parsedFrames.length);
    }, interval);

    return () => clearInterval(timer);
  }, [inspectPost, inspectPlaying]);

  // Handle PNG Download if Allowed
  const handleDownloadPNG = (post: CommunityPost) => {
    if (post.allowDownload === false) {
      toast.error(
        language === 'en'
          ? 'Download is restricted by the author.'
          : 'Скачивание этой работы запрещено автором.'
      );
      return;
    }

    try {
      let parsedGrid: GridState = typeof post.grid === 'string' ? JSON.parse(post.grid) : post.grid;
      const canvas = document.createElement('canvas');
      const scale = 16; // Export scale
      canvas.width = post.width * scale;
      canvas.height = post.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      for (let r = 0; r < post.height; r++) {
        for (let c = 0; c < post.width; c++) {
          const color = parsedGrid[r]?.[c];
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(c * scale, r * scale, scale, scale);
          }
        }
      }

      const link = document.createElement('a');
      link.download = `${post.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_novablast.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success(language === 'en' ? 'Downloaded PNG artwork!' : 'Изображение PNG успешно скачано!');
    } catch (err) {
      console.error('Failed to export PNG:', err);
      toast.error(language === 'en' ? 'Failed to download PNG' : 'Не удалось скачать PNG');
    }
  };

  // Open Publish Modal
  const handleOpenPublishModal = () => {
    if (!user) {
      toast.error(language === 'en' ? 'Sign in to publish artworks!' : 'Войдите в аккаунт для публикации работ!');
      return;
    }
    if (availableProjectsToPublish.length === 0) {
      toast.error(
        language === 'en'
          ? 'You have no saved projects. Create and save a project first!'
          : 'У вас нет сохранённых проектов. Нарисуйте и сохраните проект в редакторе!'
      );
      return;
    }

    const first = availableProjectsToPublish[0];
    setSelectedProjectToPublish(first);
    setPublishTitle(first.name || '');
    setPublishDescription('');
    setPublishTags('');
    setAllowDownload(true);
    setModerationError(null);
    setIsPublishModalOpen(true);
  };

  // Generate Base64 Data URL for project grid preview
  const generateGridPreviewBase64 = (grid: GridState | string, width: number, height: number): string => {
    let parsed: GridState = typeof grid === 'string' ? JSON.parse(grid) : grid;
    const canvas = document.createElement('canvas');
    canvas.width = width * 4;
    canvas.height = height * 4;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cellW = canvas.width / width;
    const cellH = canvas.height / height;

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const color = parsed[r]?.[c];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
        }
      }
    }
    return canvas.toDataURL('image/png');
  };

  // Handle Publish Submission with Non-Blocking Background AI Moderation & Toast Notifications
  const handlePublishSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedProjectToPublish || isPublishing) return;

    const titleTrimmed = publishTitle.trim() || selectedProjectToPublish.name || 'NovaBlast Artwork';
    const parsedTags = publishTags
      .split(',')
      .map(t => t.trim().replace(/^#/, '').toLowerCase())
      .filter(t => t.length > 0)
      .slice(0, 10);

    const projectToPublish = selectedProjectToPublish;
    const descToPublish = publishDescription.trim();
    const downloadAllowedToPublish = allowDownload;

    // Lock inputs and close publish modal immediately so user can freely navigate
    setIsPublishing(true);
    setModerationError(null);
    setIsPublishModalOpen(false);

    const toastId = `moderation_${Date.now()}`;
    toast.loading(
      language === 'en'
        ? `AI moderation checking "${titleTrimmed}"... You can continue browsing.`
        : `Идёт AI-проверка проекта "${titleTrimmed}"... Вы можете продолжать просмотр или работу.`,
      { id: toastId, duration: 25000 }
    );

    // Run verification & publishing asynchronously in background
    (async () => {
      try {
        const serializedGrid = typeof projectToPublish.grid === 'string'
          ? projectToPublish.grid
          : JSON.stringify(projectToPublish.grid);

        const serializedFrames = projectToPublish.frames
          ? projectToPublish.frames.map(f => typeof f === 'string' ? f : JSON.stringify(f))
          : [serializedGrid];

        const previewDataUrl = generateGridPreviewBase64(
          projectToPublish.grid,
          projectToPublish.width,
          projectToPublish.height
        );

        // STEP 1: AI Safety Content Moderation via Server Endpoint
        const modResp = await fetch('/api/moderation/inspect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: previewDataUrl,
            title: titleTrimmed,
            description: descToPublish
          })
        });

        const modData = await modResp.json();
        if (!modData.allowed) {
          const errorReason = modData.reason || 'Содержимое проекта содержит непристойные или запрещённые элементы.';
          toast.error(
            language === 'en'
              ? `Verification Failed: "${titleTrimmed}" was rejected by AI Moderation. Reason: ${errorReason}`
              : `Проверка отклонена: Проект "${titleTrimmed}" не прошёл AI-модерацию. Причина: ${errorReason}`,
            { id: toastId, duration: 12000 }
          );
          setIsPublishing(false);
          return;
        }

        // STEP 2: Determine OAuth/Auth Provider (Google, GitHub, Steam, X, or email/password)
        let providerStr = 'email';
        
        // 1. Check if user is a session user (Steam/GitHub/X)
        if (user.provider) {
           providerStr = user.provider;
        } 
        // 2. Check if Firebase user has provider data
        else if (user.providerData && user.providerData.length > 0) {
          const pId = user.providerData[0].providerId.toLowerCase();
          if (pId.includes('google')) providerStr = 'google';
          else if (pId.includes('github')) providerStr = 'github';
          else if (pId.includes('twitter') || pId.includes('x')) providerStr = 'x';
          else if (pId.includes('steam')) providerStr = 'steam';
          else providerStr = 'email';
        }
        
        console.log('[Publish] Determined provider:', providerStr, 'for user:', user.uid);

        // STEP 3: Save to Firestore
        const newPostRef = doc(collection(db, 'community_posts'));
        const newPost: Omit<CommunityPost, 'id'> = {
          title: titleTrimmed,
          description: descToPublish,
          authorId: user.uid,
          authorName: user.displayName || user.email?.split('@')[0] || 'Pixel Artist',
          authorAvatar: user.photoURL || '',
          authorProvider: providerStr,
          previewImage: previewDataUrl,
          grid: serializedGrid,
          frames: serializedFrames,
          width: projectToPublish.width,
          height: projectToPublish.height,
          fps: projectToPublish.fps || 8,
          projectType: projectToPublish.projectType || 'static',
          likesCount: 0,
          viewsCount: 0,
          allowDownload: downloadAllowedToPublish,
          tags: parsedTags,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };

        await setDoc(newPostRef, newPost);

        toast.success(
          language === 'en'
            ? `Verification Success! Artwork "${titleTrimmed}" passed AI check & published to gallery!`
            : `Проверка завершена! Проект "${titleTrimmed}" успешно прошёл AI-проверку и опубликован в галерее!`,
          { id: toastId, duration: 8000 }
        );

        fetchPosts();
      } catch (err: any) {
        console.error('Failed to publish post in background:', err);
        toast.error(
          language === 'en' ? `Failed to publish "${titleTrimmed}"` : `Ошибка при публикации проекта "${titleTrimmed}"`,
          { id: toastId }
        );
      } finally {
        setIsPublishing(false);
      }
    })();
  };

  // Handle Delete Post (Owner/Admin)
  const handleDeletePost = (post: CommunityPost, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user || (user.uid !== post.authorId && user.email !== 'zuravlevm379@gmail.com')) {
      toast.error(language === 'en' ? 'You can only delete your own publications!' : 'Вы можете удалять только свои публикации!');
      return;
    }
    setPostToDelete(post);
  };

  const handleConfirmDeletePost = async () => {
    if (!postToDelete || !user) return;
    if (user.uid !== postToDelete.authorId && user.email !== 'zuravlevm379@gmail.com') return;

    setIsDeletingPost(true);
    try {
      await deleteDoc(doc(db, 'community_posts', postToDelete.id));
      setPosts(prev => prev.filter(p => p.id !== postToDelete.id));
      if (inspectPost?.id === postToDelete.id) setInspectPost(null);
      if (editingPost?.id === postToDelete.id) {
        setIsEditModalOpen(false);
        setEditingPost(null);
      }
      toast.success(language === 'en' ? 'Publication deleted from gallery' : 'Публикация удалена из галереи');
      setPostToDelete(null);
    } catch (err) {
      console.error('Failed to delete post:', err);
      toast.error(language === 'en' ? 'Failed to delete' : 'Не удалось удалить публикацию');
    } finally {
      setIsDeletingPost(false);
    }
  };

  // Filtered and Sorted Posts
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = post.title.toLowerCase().includes(q);
        const matchAuthor = post.authorName.toLowerCase().includes(q);
        const matchDesc = post.description?.toLowerCase().includes(q);
        const matchTag = post.tags?.some(t => t.toLowerCase().includes(q));
        if (!matchTitle && !matchAuthor && !matchDesc && !matchTag) return false;
      }
      // Selected Tag
      if (selectedTag && !post.tags?.includes(selectedTag)) {
        return false;
      }
      // Tabs
      if (activeTab === 'animated' && post.projectType !== 'animated') return false;
      if (activeTab === 'static' && post.projectType !== 'static') return false;
      if (activeTab === 'my') {
        if (!user || post.authorId !== user.uid) return false;
      }
      return true;
    }).sort((a, b) => {
      if (activeTab === 'popular') {
        return (b.likesCount || 0) - (a.likesCount || 0);
      }
      return 0; // Default created order
    });
  }, [posts, searchQuery, selectedTag, activeTab, user?.uid]);

  // All unique tags across posts
  const allTags = useMemo(() => {
    const set = new Set<string>();
    posts.forEach(p => p.tags?.forEach(t => set.add(t)));
    return Array.from(set).slice(0, 12);
  }, [posts]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-[0_0_60px_rgba(79,70,229,0.2)] overflow-hidden">
        
        {/* Gallery Header */}
        <div className="flex flex-col gap-4 p-5 sm:p-6 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Compass className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-pixel text-white flex items-center gap-2">
                  <span>{language === 'en' ? 'Community Gallery' : 'Галерея Сообщества'}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-mono">
                    NovaBlast
                  </span>
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  {language === 'en'
                    ? 'Explore real pixel art created and published by artists'
                    : 'Настоящие пиксель-арты, созданные и опубликованные пользователями'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {user ? (
                <>
                  {/* Current User Account Profile */}
                  <div className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 p-1 pl-1.5 pr-2.5 rounded-full transition-colors">
                    {user.photoURL ? (
                      <img 
                        src={user.photoURL} 
                        alt={user.displayName || ''} 
                        className="w-7 h-7 rounded-full border border-white/10 object-cover" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                        <UserIcon size={14} />
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 max-w-[120px] sm:max-w-[170px]">
                      <span className="text-xs font-mono font-medium text-slate-200 truncate">
                        {user.displayName || user.email?.split('@')[0] || (language === 'en' ? 'User' : 'Пользователь')}
                      </span>
                      <ProviderBadge provider={getUserProvider(user)} />
                    </div>
                    {onLogout && (
                      <button 
                        onClick={onLogout} 
                        className="ml-0.5 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer p-1 rounded-full hover:bg-white/5"
                        title={language === 'en' ? 'Sign out' : 'Выйти из аккаунта'}
                      >
                        <LogOut size={13} />
                      </button>
                    )}
                  </div>

                  {/* Publish Project Button (Only available when logged in) */}
                  <button
                    onClick={handleOpenPublishModal}
                    className="flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      {language === 'en' ? 'Publish Your Project' : 'Опубликовать свой проект'}
                    </span>
                  </button>
                </>
              ) : (
                /* Log In Button (When not logged in) */
                <button
                  onClick={onOpenAuth}
                  className="flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/30 transition-all cursor-pointer whitespace-nowrap"
                >
                  <LogIn className="w-4 h-4" />
                  <span>
                    {language === 'en' ? 'Log In' : 'Войти'}
                  </span>
                </button>
              )}

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
                title={language === 'en' ? 'Close' : 'Закрыть'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Bar & Filter Controls */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={
                  language === 'en'
                    ? 'Search by title, author, or tag...'
                    : 'Поиск по названию, автору или тегу...'
                }
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Segmented Filter Buttons */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto shrink-0">
              <button
                onClick={() => setActiveTab('popular')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'popular'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Star className="w-3.5 h-3.5 text-amber-400" />
                <span>{language === 'en' ? 'Popular' : 'Популярные'}</span>
              </button>
              <button
                onClick={() => setActiveTab('latest')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'latest'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                <span>{language === 'en' ? 'Latest' : 'Новые'}</span>
              </button>
              <button
                onClick={() => setActiveTab('animated')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'animated'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Film className="w-3.5 h-3.5 text-sky-400" />
                <span>{language === 'en' ? 'Animations' : 'Анимации'}</span>
              </button>
              <button
                onClick={() => setActiveTab('static')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'static'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                <span>{language === 'en' ? 'Static' : 'Статичные'}</span>
              </button>
              {user && (
                <button
                  onClick={() => setActiveTab('my')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'my'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{language === 'en' ? 'My Posts' : 'Мои публикации'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Tags Filter Ribbon */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-slate-400">
              <span className="shrink-0 flex items-center gap-1 font-mono text-[11px] text-slate-500">
                <Tag className="w-3 h-3" /> Теги:
              </span>
              {selectedTag && (
                <button
                  onClick={() => setSelectedTag(null)}
                  className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <span>Все</span>
                  <X className="w-3 h-3" />
                </button>
              )}
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`px-2 py-0.5 rounded-md font-mono text-[11px] transition-all cursor-pointer ${
                    selectedTag === tag
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Gallery Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Sparkles className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-sm font-mono">{language === 'en' ? 'Loading gallery...' : 'Загрузка галереи...'}</p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-center p-6 border-2 border-dashed border-slate-800 rounded-2xl">
              <Compass className="w-12 h-12 text-slate-600" />
              <h3 className="text-base font-bold text-slate-300">
                {language === 'en' ? 'No published artworks yet' : 'В галерее пока нет опубликованных работ'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                {searchQuery || selectedTag
                  ? (language === 'en' ? 'Try changing your search filters.' : 'Попробуйте изменить параметры поиска.')
                  : (language === 'en' ? 'Be the first artist to publish a project from your saved artworks!' : 'Опубликуйте один из ваших сохранённых проектов, чтобы открыть галерею!')}
              </p>
              {user ? (
                <button
                  onClick={handleOpenPublishModal}
                  className="mt-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs cursor-pointer shadow-md"
                >
                  {language === 'en' ? 'Publish a Project' : 'Опубликовать проект'}
                </button>
              ) : (
                <button
                  onClick={onOpenAuth}
                  className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs cursor-pointer shadow-md shadow-indigo-600/30 flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{language === 'en' ? 'Sign in to Publish' : 'Войдите для публикации'}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredPosts.map(post => {
                const isLiked = Boolean(userLikes[post.id]);
                return (
                  <motion.div
                    key={post.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ y: -3 }}
                    onClick={() => handleOpenInspect(post)}
                    className="group relative bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-xl overflow-hidden shadow-lg transition-all cursor-pointer flex flex-col"
                  >
                    {/* Pixel Art Canvas Preview Header */}
                    <div className="relative aspect-square bg-slate-900 border-b border-slate-800 flex items-center justify-center p-3 overflow-hidden">
                      <PixelCanvasRenderer
                        gridData={post.grid}
                        width={post.width}
                        height={post.height}
                        className="w-full h-full object-contain max-h-48 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
                      />

                      {/* Type & License Badges */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md border border-white/10 text-[10px] font-mono text-slate-300">
                          {post.projectType === 'animated' ? (
                            <>
                              <Film className="w-3 h-3 text-sky-400" />
                              <span>{post.fps || 8} FPS</span>
                            </>
                          ) : (
                            <>
                              <ImageIcon className="w-3 h-3 text-purple-400" />
                              <span>{post.width}x{post.height}</span>
                            </>
                          )}
                        </div>
                        {post.allowDownload === false && (
                          <div className="p-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-rose-500/30 text-rose-400" title="Скачивание запрещено автором">
                            <Lock className="w-3 h-3" />
                          </div>
                        )}
                        {user && (user.uid === post.authorId || user.email === 'zuravlevm379@gmail.com') && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => handleOpenEditModal(post, e)}
                              className="p-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-indigo-500/40 text-indigo-300 hover:text-white hover:bg-indigo-600 transition-colors cursor-pointer"
                              title="Редактировать публикацию"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => handleDeletePost(post, e)}
                              className="p-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-rose-500/40 text-rose-300 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer"
                              title="Удалить публикацию"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* View Hover Overlay */}
                      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-3">
                        <div className="px-3.5 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/40">
                          <Eye className="w-4 h-4" />
                          <span>Просмотр</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Metadata */}
                    <div className="p-3.5 flex flex-col flex-1 justify-between gap-2.5">
                      <div>
                        <h3 className="font-bold text-sm text-slate-100 group-hover:text-indigo-400 transition-colors line-clamp-1">
                          {post.title}
                        </h3>
                        
                        {/* Unboxed Metadata (Zero-pill discipline) */}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1 font-mono">
                          <div className="flex items-center gap-1">
                            {post.authorAvatar ? (
                              <img src={post.authorAvatar} alt="" className="w-4 h-4 rounded-full border border-white/10" />
                            ) : (
                              <UserIcon className="w-3 h-3 text-slate-500" />
                            )}
                            <span className="truncate max-w-[100px] text-slate-300">{post.authorName}</span>
                          </div>
                          <ProviderBadge provider={post.authorProvider} />
                        </div>
                      </div>

                      {/* Footer Stats & Like Action */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-xs text-slate-400">
                        <div className="flex items-center gap-3 font-mono text-[11px]">
                          <span className="flex items-center gap-1 text-slate-400" title="Просмотры">
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>{post.viewsCount || 0}</span>
                          </span>
                        </div>

                        <button
                          onClick={e => handleToggleLike(post, e)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                            isLiked
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-sm shadow-rose-500/20'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-rose-500 text-rose-500 animate-bounce' : ''}`} />
                          <span>{post.likesCount || 0}</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Inspect & Read-Only Modal */}
      <AnimatePresence>
        {inspectPost && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
            >
              {/* Close Button */}
              <button
                onClick={() => setInspectPost(null)}
                className="absolute top-3 right-3 z-10 p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Artwork Viewport Left */}
              <div className="w-full md:w-1/2 bg-slate-950 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-800 relative min-h-[300px]">
                <PixelCanvasRenderer
                  gridData={
                    inspectPost.projectType === 'animated' && inspectPost.frames && inspectPost.frames.length > 0
                      ? inspectPost.frames[inspectFrameIndex]
                      : inspectPost.grid
                  }
                  width={inspectPost.width}
                  height={inspectPost.height}
                  className="max-w-full max-h-[350px] object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)]"
                />

                {/* Animation playback controls */}
                {inspectPost.projectType === 'animated' && inspectPost.frames && inspectPost.frames.length > 1 && (
                  <div className="mt-4 flex items-center gap-3 bg-slate-900/90 border border-slate-800 px-3.5 py-1.5 rounded-full text-xs text-slate-300 font-mono">
                    <button
                      onClick={() => setInspectPlaying(!inspectPlaying)}
                      className="p-1 text-indigo-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {inspectPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <span>Кадр {inspectFrameIndex + 1} / {inspectPost.frames.length}</span>
                    <span className="text-slate-500">|</span>
                    <span>{inspectPost.fps || 8} FPS</span>
                  </div>
                )}
              </div>

              {/* Artwork Specs & Read-Only Details Right */}
              <div className="w-full md:w-1/2 p-6 flex flex-col justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-mono text-[11px]">
                      {inspectPost.width}x{inspectPost.height} px
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-300 font-mono text-[11px]">
                      {inspectPost.projectType === 'animated' ? 'Анимация' : 'Статичный арт'}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-white mb-1">{inspectPost.title}</h2>

                  {/* Author line */}
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mb-3">
                    {inspectPost.authorAvatar ? (
                      <img src={inspectPost.authorAvatar} alt="" className="w-5 h-5 rounded-full" />
                    ) : (
                      <UserIcon className="w-4 h-4 text-slate-500" />
                    )}
                    <span className="text-slate-200 font-medium">{inspectPost.authorName}</span>
                    <ProviderBadge provider={inspectPost.authorProvider} />
                  </div>

                  {/* Description if present */}
                  {inspectPost.description && (
                    <p className="text-xs text-slate-300 leading-relaxed mb-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 max-h-32 overflow-y-auto font-mono">
                      {inspectPost.description}
                    </p>
                  )}

                  {/* Tags */}
                  {inspectPost.tags && inspectPost.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {inspectPost.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-[11px]">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stats Counter */}
                  <div className="flex items-center gap-4 py-3 border-y border-slate-800 text-xs font-mono text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Heart className="w-4 h-4 text-rose-400" />
                      <span>{inspectPost.likesCount || 0} лайков</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-slate-400" />
                      <span>{inspectPost.viewsCount || 0} просмотров</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions: Read-Only Download or License restriction */}
                <div className="flex flex-col gap-2.5">
                  {inspectPost.allowDownload !== false ? (
                    <button
                      onClick={() => handleDownloadPNG(inspectPost)}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold font-mono text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>{language === 'en' ? 'Download PNG Artwork' : 'Скачать PNG работу'}</span>
                    </button>
                  ) : (
                    <div className="w-full py-2.5 bg-slate-950 border border-rose-500/30 rounded-xl font-mono text-xs text-rose-400 flex items-center justify-center gap-2">
                      <Lock className="w-4 h-4" />
                      <span>{language === 'en' ? 'Download Locked by Author' : 'Скачивание запрещено автором'}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => handleToggleLike(inspectPost, e)}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        userLikes[inspectPost.id]
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${userLikes[inspectPost.id] ? 'fill-rose-500 text-rose-500' : ''}`} />
                      <span>{userLikes[inspectPost.id] ? 'В избранном' : 'Поставить лайк'}</span>
                    </button>

                    {user && (user.uid === inspectPost.authorId || user.email === 'zuravlevm379@gmail.com') && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => handleOpenEditModal(inspectPost, e)}
                          className="p-2.5 rounded-xl bg-slate-950 hover:bg-indigo-950 text-slate-400 hover:text-indigo-300 border border-slate-800 transition-colors cursor-pointer"
                          title="Редактировать публикацию"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePost(inspectPost)}
                          className="p-2.5 rounded-xl bg-slate-950 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors cursor-pointer"
                          title="Удалить публикацию"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Publish Project Selector & AI Moderation Modal */}
      <AnimatePresence>
        {isPublishModalOpen && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.form
              onSubmit={handlePublishSubmit}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-base text-white flex items-center gap-2 font-pixel">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  <span>{language === 'en' ? 'Publish Saved Project' : 'Публикация сохранённого проекта'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsPublishModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 1. Select Project Dropdown */}
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5">
                  {language === 'en' ? 'Select Project from Saved Works' : 'Выберите проект из ваших сохранённых работ:'}
                </label>
                <select
                  disabled={isPublishing}
                  value={selectedProjectToPublish?.id || ''}
                  onChange={e => {
                    const found = availableProjectsToPublish.find(p => p.id === e.target.value);
                    if (found) {
                      setSelectedProjectToPublish(found);
                      setPublishTitle(found.name || '');
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-white outline-none font-mono disabled:opacity-50"
                >
                  {availableProjectsToPublish.map(proj => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name} ({proj.width}x{proj.height} px)
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Live Project Preview Canvas Card */}
              {selectedProjectToPublish && (
                <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl flex items-center gap-4">
                  <div className="w-24 h-24 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center p-1 shrink-0">
                    <PixelCanvasRenderer
                      gridData={selectedProjectToPublish.grid}
                      width={selectedProjectToPublish.width}
                      height={selectedProjectToPublish.height}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 text-xs font-mono">
                    <div className="font-bold text-slate-100 text-sm">{selectedProjectToPublish.name}</div>
                    <div className="text-slate-400 mt-1">Размер: {selectedProjectToPublish.width}x{selectedProjectToPublish.height} px</div>
                    <div className="text-slate-400">Тип: {selectedProjectToPublish.projectType === 'animated' ? `Анимация (${selectedProjectToPublish.frames?.length || 1} кадр.)` : 'Статичный'}</div>
                  </div>
                </div>
              )}

              {/* 3. Title Input */}
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  {language === 'en' ? 'Title' : 'Название работы'}
                </label>
                <input
                  type="text"
                  disabled={isPublishing}
                  value={publishTitle}
                  onChange={e => setPublishTitle(e.target.value)}
                  maxLength={100}
                  required
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-white outline-none disabled:opacity-50"
                />
              </div>

              {/* 4. Description Textarea */}
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  {language === 'en' ? 'Description' : 'Описание работы'}
                </label>
                <textarea
                  disabled={isPublishing}
                  value={publishDescription}
                  onChange={e => setPublishDescription(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder={language === 'en' ? 'Tell the story of this artwork...' : 'Расскажите об истории или деталях этой работы...'}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-white outline-none resize-none font-mono disabled:opacity-50"
                />
              </div>

              {/* 5. Tags */}
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  {language === 'en' ? 'Tags (comma separated)' : 'Теги (через запятую)'}
                </label>
                <input
                  type="text"
                  disabled={isPublishing}
                  value={publishTags}
                  onChange={e => setPublishTags(e.target.value)}
                  placeholder="cyberpunk, magic, character, potion"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-white outline-none disabled:opacity-50"
                />
              </div>

              {/* 6. License Permissions Toggle */}
              <div className="bg-slate-950 p-3.5 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {allowDownload ? <Unlock className="w-5 h-5 text-emerald-400 shrink-0" /> : <Lock className="w-5 h-5 text-rose-400 shrink-0" />}
                  <div>
                    <div className="text-xs font-bold text-white font-mono">
                      {allowDownload
                        ? (language === 'en' ? 'Allow PNG Download' : 'Разрешить скачивание PNG')
                        : (language === 'en' ? 'View Only (Download Locked)' : 'Только для просмотра (Скачивание запрещено)')}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {allowDownload
                        ? 'Другие пользователи смогут сохранить работу на свой ПК.'
                        : 'Запретить другим пользователям скачивать ваш файл.'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isPublishing}
                  onClick={() => setAllowDownload(!allowDownload)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors disabled:opacity-50 ${
                    allowDownload ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {allowDownload ? 'Разрешено' : 'Запрещено'}
                </button>
              </div>

              {/* Moderation Error Warning Banner */}
              {moderationError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono flex items-start gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Модерация AI отклонила публикацию:</div>
                    <div className="text-[11px] text-rose-200/80 mt-0.5">{moderationError}</div>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPublishModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono font-bold cursor-pointer"
                >
                  {language === 'en' ? 'Cancel' : 'Отмена'}
                </button>
                <button
                  type="submit"
                  disabled={isPublishing}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isPublishing ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin text-purple-300" />
                      <span>{language === 'en' ? 'Sending to AI Check...' : 'Отправка на AI-проверку...'}</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>{language === 'en' ? 'Publish Artwork' : 'Опубликовать'}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Publication Modal for Authors / Admins */}
      <AnimatePresence>
        {isEditModalOpen && editingPost && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.form
              onSubmit={handleSaveEditSubmit}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-base text-white flex items-center gap-2 font-pixel">
                  <Edit2 className="w-5 h-5 text-indigo-400" />
                  <span>{language === 'en' ? 'Edit Publication' : 'Редактирование публикации'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  {language === 'en' ? 'Title' : 'Название работы'}
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  maxLength={100}
                  required
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-white outline-none font-mono"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  {language === 'en' ? 'Description' : 'Описание работы'}
                </label>
                <textarea
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-white outline-none resize-none font-mono"
                />
              </div>

              {/* License Permissions Toggle */}
              <div className="bg-slate-950 p-3.5 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {editAllowDownload ? <Unlock className="w-5 h-5 text-emerald-400 shrink-0" /> : <Lock className="w-5 h-5 text-rose-400 shrink-0" />}
                  <div>
                    <div className="text-xs font-bold text-white font-mono">
                      {editAllowDownload
                        ? (language === 'en' ? 'Allow PNG Download' : 'Разрешить скачивание PNG')
                        : (language === 'en' ? 'View Only (Download Locked)' : 'Только для просмотра (Скачивание запрещено)')}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditAllowDownload(!editAllowDownload)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors ${
                    editAllowDownload ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {editAllowDownload ? 'Разрешено' : 'Запрещено'}
                </button>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const target = editingPost;
                    setIsEditModalOpen(false);
                    if (target) handleDeletePost(target);
                  }}
                  className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-rose-500/30"
                  title="Удалить публикацию"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{language === 'en' ? 'Delete' : 'Удалить'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono font-bold cursor-pointer"
                  >
                    {language === 'en' ? 'Cancel' : 'Отмена'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSavingEdit ? (
                      <Sparkles className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>{language === 'en' ? 'Save Changes' : 'Сохранить изменения'}</span>
                  </button>
                </div>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {postToDelete && (
          <div className="fixed inset-0 z-[230] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6 animate-pulse" />
              </div>

              <div>
                <h3 className="font-bold text-white text-base font-pixel mb-1">
                  {language === 'en' ? 'Delete Publication?' : 'Удалить публикацию?'}
                </h3>
                <p className="text-xs text-slate-400 font-mono leading-relaxed">
                  {language === 'en'
                    ? `Are you sure you want to remove "${postToDelete.title}" from the community gallery? This action cannot be undone.`
                    : `Вы уверены, что хотите удалить работу "${postToDelete.title}" из галереи сообщества? Это действие необратимо.`}
                </p>
              </div>

              <div className="flex items-center gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  disabled={isDeletingPost}
                  onClick={() => setPostToDelete(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {language === 'en' ? 'Cancel' : 'Отмена'}
                </button>
                <button
                  type="button"
                  disabled={isDeletingPost}
                  onClick={handleConfirmDeletePost}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-md shadow-rose-600/30 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isDeletingPost ? (
                    <Sparkles className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>{language === 'en' ? 'Delete' : 'Удалить'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Sub-component to render pixel grid onto HTML5 Canvas
const PixelCanvasRenderer: React.FC<{
  gridData: string | GridState;
  width: number;
  height: number;
  className?: string;
}> = ({ gridData, width, height, className }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let parsedGrid: GridState = [];
    try {
      parsedGrid = typeof gridData === 'string' ? JSON.parse(gridData) : gridData;
    } catch (e) {
      return;
    }

    const w = width || parsedGrid[0]?.length || 16;
    const h = height || parsedGrid.length || 16;

    canvas.width = w * 8;
    canvas.height = h * 8;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cellW = canvas.width / w;
    const cellH = canvas.height / h;

    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const color = parsedGrid[r]?.[c];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
        }
      }
    }
  }, [gridData, width, height]);

  return <canvas ref={canvasRef} className={className} style={{ imageRendering: 'pixelated' }} />;
};
