import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const Signup = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!fullName || !email || !password || !confirmPassword) {
      toast.error("Please fill all fields");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const { error } = await signUp(email, password, fullName);
      if (error) throw error;

      toast.success("Account created! Please check your email to verify.");
      navigate("/login");
    } catch (error) {
      toast.error(error.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-primary/20 text-primary mb-4">
            <span className="material-symbols-outlined text-4xl">gavel</span>
          </div>
          <h1 className="text-3xl font-black text-white">Auction Pro</h1>
          <p className="text-text-secondary mt-2">
            Create your account to get started
          </p>
        </div>

        {/* Signup Form */}
        <div className="bg-card-dark border border-[#283539] rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Full Name
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-xl">
                  person
                </span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full h-12 pl-10 pr-4 bg-[#1c2e35] border border-[#283539] rounded-xl text-white placeholder:text-text-secondary focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Email Address
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-xl">
                  mail
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-12 pl-10 pr-4 bg-[#1c2e35] border border-[#283539] rounded-xl text-white placeholder:text-text-secondary focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Password
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-xl">
                  lock
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full h-12 pl-10 pr-4 bg-[#1c2e35] border border-[#283539] rounded-xl text-white placeholder:text-text-secondary focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-xl">
                  lock
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="w-full h-12 pl-10 pr-4 bg-[#1c2e35] border border-[#283539] rounded-xl text-white placeholder:text-text-secondary focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-background-dark font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="size-5 border-2 border-background-dark border-t-transparent rounded-full animate-spin"></div>
                  Creating account...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">
                    person_add
                  </span>
                  Create Account
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-[#283539]"></div>
            <span className="text-text-secondary text-sm">or</span>
            <div className="flex-1 h-px bg-[#283539]"></div>
          </div>

          {/* Login Link */}
          <p className="text-center text-text-secondary">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-primary hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* Trademark */}
        <p className="text-center text-text-secondary/50 text-xs mt-6">
          © {new Date().getFullYear()} Made by{" "}
          <span className="text-primary">Nikhil</span>
        </p>
      </div>
    </div>
  );
};

export default Signup;
