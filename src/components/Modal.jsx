const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      
      {/* Modal Content */}
      <div className="relative bg-card-dark border border-[#283539] rounded-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#283539]">
          <h3 className="text-white text-lg font-bold">{title}</h3>
          <button 
            onClick={onClose}
            className="size-8 rounded-lg bg-[#283539] hover:bg-[#3b4e54] flex items-center justify-center text-text-secondary hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        
        {/* Body */}
        <div className="p-5 overflow-y-auto max-h-[calc(90vh-80px)]">
          {children}
        </div>
      </div>
    </div>
  )
}

export default Modal
