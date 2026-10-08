"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Envio em curso: `sendRequest` faz o pedido de envio e `waiting` fica a
 * true até o servidor responder. Enquanto espera, o browser avisa quem
 * tentar fechar ou recarregar a página, porque o resultado do envio só
 * aparece aqui.
 *
 * O aviso não cobre a navegação dentro da aplicação (menu lateral): aí o
 * envio continua no servidor, só se perde o alerta com o resultado.
 */
export default function useSendProgress() {
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!waiting) return undefined;

    const warnBeforeLeaving = (event) => {
      event.preventDefault();
      /* Browsers mais antigos só avisam com returnValue preenchido. */
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnBeforeLeaving);

    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [waiting]);

  const sendRequest = useCallback(async (url, init) => {
    setWaiting(true);

    try {
      return await fetch(url, init);
    } finally {
      setWaiting(false);
    }
  }, []);

  return { waiting, sendRequest };
}
