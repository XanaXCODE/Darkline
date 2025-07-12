# 📡 Darkline Bluetooth Mesh Networking

## 🎯 Visão Geral

O Darkline agora inclui funcionalidade de **comunicação offline** através de Bluetooth mesh networking! Esta implementação permite que usuários se comuniquem diretamente entre dispositivos próximos sem necessidade de conexão com a internet ou servidores centralizados.

## 🔒 Backup e Reversão

**IMPORTANTE**: Um backup completo foi criado antes da implementação:
```bash
# Backup localizado em:
/home/xanax/chat/darkline-backup-20250712-160138

# Para reverter para o estado anterior:
cd /home/xanax/chat/
rm -rf darkline
mv darkline-backup-20250712-160138 darkline
```

## 🚀 Novo Comando

### Bluetooth P2P Mesh Network
```bash
# Entrar na rede mesh Bluetooth P2P (sem servidor necessário!)
darkline bluetooth -n <nickname> [opções]

# Opções disponíveis:
-n, --nickname <nickname>  # Seu nickname (obrigatório)
--discovery-interval <ms>  # Intervalo de descoberta em ms (padrão: "30000")
--heartbeat-interval <ms>  # Intervalo de heartbeat em ms (padrão: "10000")
--max-hops <hops>          # Máximo de saltos de mensagem (padrão: "5")
--no-encryption            # Desabilitar criptografia de mensagens
```

> **🎯 Arquitetura Simplificada**: Não há mais necessidade de servidor dedicado! Cada dispositivo é um nó igual na rede mesh P2P.

## 📋 Exemplos de Uso

### 1. Entrando na Rede Mesh P2P
```bash
# Básico - entra na rede mesh
darkline bluetooth -n xanax

# Com configurações personalizadas
darkline bluetooth -n love --max-hops 3 --discovery-interval 20000

# Modo conservador (baixo consumo)
darkline bluetooth -n user --heartbeat-interval 30000 --discovery-interval 60000
```

### 2. Comandos Durante o Chat P2P
Quando na rede mesh Bluetooth, você pode usar:
```bash
/devices    # Mostrar dispositivos Bluetooth conectados
/peers      # Mostrar peers Darkline conectados
/status     # Status completo da rede mesh
/dm <nick> <msg>  # Enviar mensagem direta
/help       # Mostrar ajuda
quit        # Sair da rede mesh
```

### 3. Exemplo de Sessão Real
```bash
$ darkline bluetooth -n alice
🚀 Joining Bluetooth mesh network as alice...
📡 Node ID: a1b2c3d4...
✅ Bluetooth mesh network joined successfully!
🔍 Scanning for nearby Darkline peers...

📱 Peer discovered: bob_device (RSSI: -45)
🔗 Connected to peer: bob_device
👋 bob joined the mesh
💬 You can now chat! Type messages and press Enter

> hello everyone!
You: hello everyone!
bob: hey alice! welcome to the mesh
> /status
📊 Mesh Status:
  Active in mesh: ✅ Yes
  Bluetooth devices: 1
  Connected peers: 1
  Your Node ID: a1b2c3d4...
```

## 🛠️ Arquitetura Técnica

### Componentes Implementados:

1. **BluetoothMeshManager** (`src/bluetooth/mesh-manager.ts`)
   - Gerencia descoberta e conexão de dispositivos
   - Implementa roteamento mesh com tabelas de rota
   - Controla heartbeat e limpeza de nós obsoletos

2. **BluetoothP2PClient** (`src/bluetooth/peer-to-peer-client.ts`)
   - Cliente P2P completo (sem necessidade de servidor)
   - Cada dispositivo é um nó igual na rede
   - Gerencia peers, mensagens e histórico local
   - Interface simplificada para comunicação mesh

3. **Simulator** (`src/bluetooth/simulator.ts`)
   - Simulador Bluetooth para desenvolvimento/teste
   - Ativa automaticamente quando Bluetooth real não disponível
   - Simula dispositivos Darkline próximos para testes

### Características:

- ✅ **P2P Puro**: Sem necessidade de servidor - cada dispositivo é um peer igual
- ✅ **Mesh Networking**: Mensagens são roteadas através de múltiplos dispositivos
- ✅ **Descoberta Automática**: Detecta automaticamente dispositivos Darkline próximos
- ✅ **Auto-organização**: Rede se forma e reorganiza automaticamente
- ✅ **Criptografia**: Mensagens assinadas digitalmente (opcional)
- ✅ **Fallback Inteligente**: Usa simulador quando Bluetooth não disponível
- ✅ **Interface Dedicada**: CLI especializada para comunicação P2P
- ✅ **Roteamento Inteligente**: Controle de TTL e prevenção de loops

## 🔍 Como Funciona (P2P)

1. **Descoberta Automática**: Cada dispositivo escaneia por outros nós Darkline
2. **Conexão Peer-to-Peer**: Dispositivos se conectam diretamente entre si
3. **Formação de Mesh**: Rede se auto-organiza sem servidor central
4. **Propagação de Mensagens**: Mensagens são retransmitidas pelos peers
5. **Roteamento Distribuído**: Cada nó decide o melhor caminho para as mensagens
6. **Auto-reparação**: Rede se reorganiza quando dispositivos saem/entram

## 🎮 Testando o Sistema

### Simulação (WSL/ambientes sem Bluetooth):
O sistema detecta automaticamente quando Bluetooth real não está disponível e ativa o modo simulador:

```bash
# Terminal 1
darkline bluetooth -n alice
# Output: "Using Bluetooth simulator (noble not available)"

# Terminal 2 (nova janela)
darkline bluetooth -n bob

# Os dois terminais irão "descobrir" um ao outro via simulação!
```

### Bluetooth Real (Linux com Bluetooth):
Se você tiver Bluetooth funcional, o sistema usará o hardware real automaticamente.

## 📱 Casos de Uso

1. **Comunicação em Eventos**: Chat offline em conferências, festivais
2. **Emergências**: Comunicação quando internet não disponível
3. **Áreas Remotas**: Chat em locais sem cobertura de rede
4. **Privacidade**: Comunicação local sem passar por servidores
5. **Gaming/LAN Parties**: Chat em grupos locais

## 🔧 Configuração Avançada

### Ajustando Performance:
```bash
# Rede mais agressiva (baixa latência)
darkline bluetooth-server --discovery-interval 10000 --heartbeat-interval 5000

# Rede conservadora (baixo consumo)
darkline bluetooth-server --discovery-interval 60000 --heartbeat-interval 30000
```

### Limitando Alcance:
```bash
# Mensagens morrem após 2 saltos
darkline bluetooth-connect -n user --max-hops 2
```

## 🚨 Notas Importantes

1. **Compatibilidade**: Funciona em Linux com Bluetooth LE
2. **WSL**: Usa simulador automaticamente (sem hardware Bluetooth)
3. **Distância**: Alcance limitado pelo Bluetooth (~10-100m dependendo do dispositivo)
4. **Performance**: Latência maior que WebSocket, mas funciona offline
5. **Segurança**: Mensagens assinadas digitalmente por padrão

## 🔄 Sistema Existente

O sistema WebSocket original permanece **100% intacto**:
- `darkline server` - Servidor WebSocket normal
- `darkline connect` - Cliente WebSocket normal
- Todos os comandos e funcionalidades anteriores funcionam normalmente

A funcionalidade Bluetooth é **completamente adicional** e não afeta o sistema existente.

---

**🎉 Agora você tem comunicação offline através de Bluetooth mesh networking no Darkline!**