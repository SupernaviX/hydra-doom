import React, { useEffect, useState } from "react";
import Modal from "../Modal";
import { API_BASE_URL, API_KEY } from "../../constants";
import { useQuery } from "@tanstack/react-query";
import Button from "../Button";
import {
  FaWallet,
  FaDiscord,
  FaGithub,
  FaGoogle,
  FaTwitter,
} from "react-icons/fa6";
import { useAppContext } from "../../context/useAppContext";
import { AuthResponse } from "../../types";

interface LoginModalProps {
  close: () => void;
  isOpen: boolean;
  showActionButtons: () => void;
}

const providerIcons: { [key: string]: JSX.Element } = {
  wallet: <FaWallet />,
  google: <FaGoogle />,
  twitter: <FaTwitter />,
  discord: <FaDiscord />,
  github: <FaGithub />,
};

const fetchAuthProviders = async (): Promise<string[]> => {
  const response = await fetch(`${API_BASE_URL}/auth/providers`);
  if (!response.ok) {
    throw new Error("Failed to fetch auth providers");
  }
  return response.json();
};

const checkSignin = async (sessionKeyBech32: string): Promise<AuthResponse> => {
  const response = await fetch(
    `${API_BASE_URL}/auth/check/${API_KEY}/?reference=${sessionKeyBech32}`,
  );
  if (!response.ok) {
    throw new Error("Failed to check sign-in status");
  }
  return response.json();
};

const LoginModal: React.FC<LoginModalProps> = ({
  close,
  isOpen,
  showActionButtons,
}) => {
  const { keys, setAccountData } = useAppContext();
  const { sessionKeyBech32 } = keys || {};
  const [isWaitingSigning, setIsWaitingSigning] = useState(false);

  const { data: providers, isLoading: isLoadingProviders } = useQuery<string[]>(
    {
      queryKey: ["authProviders"],
      queryFn: fetchAuthProviders,
    },
  );

  const { data: userData } = useQuery<AuthResponse>({
    queryKey: ["signinCheck", sessionKeyBech32],
    queryFn: () => checkSignin(sessionKeyBech32 ?? ""),
    enabled: !!sessionKeyBech32 && isWaitingSigning,
    refetchInterval: 1000,
  });

  useEffect(() => {
    if (userData?.authenticated) {
      setIsWaitingSigning(false);
      close();
      showActionButtons();
      setAccountData(userData.account);
    }
  }, [
    close,
    setAccountData,
    showActionButtons,
    userData?.account,
    userData?.authenticated,
  ]);

  const handleLogin = (provider: string) => {
    if (!sessionKeyBech32) return;
    const redirectUrl = `${API_BASE_URL}/auth/init/${API_KEY}/${provider}/?reference=${sessionKeyBech32}`;
    window.open(redirectUrl, "_blank")?.focus();
    setIsWaitingSigning(true);
  };

  const renderContent = () => {
    if (isWaitingSigning) return <p>Waiting for you to sign-in...</p>;
    if (isLoadingProviders || !sessionKeyBech32) return <p>Loading...</p>;
    if (!providers?.length) return <p>No providers available.</p>;

    return (
      <div className="flex flex-col gap-6 items-center">
        {providers.map((provider) => (
          <Button
            className="w-96 h-16 flex items-center gap-4 capitalize"
            key={provider}
            onClick={() => handleLogin(provider)}
          >
            {providerIcons[provider]} {provider}
          </Button>
        ))}
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} close={close}>
      <div className="text-center text-4xl flex flex-col gap-8">
        <h1 className="text-5xl uppercase">Tournament Login</h1>
        <p className="mb-4">
          Please select a provider to login with. If you don't have an account
          you can create one with the provider of your choice.
        </p>
        {renderContent()}
      </div>
    </Modal>
  );
};

export default LoginModal;
