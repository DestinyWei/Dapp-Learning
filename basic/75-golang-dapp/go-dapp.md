
# Table of Contents

1.  [画龙点睛](#org6647e67)
2.  [高屋建瓴](#org20adf7d)
3.  [分星掰两](#orgf7086e3)
4.  [厚积薄发](#orgd23bcf9)



<a id="org6647e67"></a>

# 画龙点睛

    对于一个Web3.0的开发者,Golang的需求是很大的
    很多时候需要使用Golang来和链交互操作,来完成一些请求操作.
    那Golang怎么和链交互呢?
    本文以sepolia网络的Dex抢跑程序,以及抢购公开铸造NFT程序的部分代码来交互链上数据.
    来看一下整体的流程是如何的.


<a id="org20adf7d"></a>

# 高屋建瓴

    1. 获取到合约Abi/合约源码，如果是多文件扁平化处理
    2. 使用solc abigen等工具生成go代码
    3. 开发者调用代码 于链交互


<a id="orgf7086e3"></a>

# 分星掰两

-   获取合约代码,或者Abi

        很多链上很多swap都是使用uniswap V2的代码,比如pancake,sushi,mm...
        我们直接使用uniswap的router02以及factory 就可以了,具体的代码github里面就有,也可以直接复制下面的代码
        https://cronoscan.com/address/0x145677fc4d9b8f19b5d56d1820c48e0443049a30#contracts

        一个小技巧,很多链这个没法复制,可以点击More Options --> Compare 来复制.
        保存到truffle的一个文件夹.
        关于truffle的使用,就不啰嗦了,可以翻看具体之前项目内的文档.
        一些工具的推荐,solc-select(pip install),可以切换solc的版本

        在 contracts 文件夹 touch uniswap.sol
        copy 代码进去. 修改默认的truffle-config.js版本.
        执行  solcjs --bin uniswap.sol
        如果你顺利的话应该能碰到这种版本错误的问题

        这个问题,你首先要确定你的npm 读的是那个 solc ,然后才能解决.
        如果未在truffle项目内 npm init -f .那直接删除掉全局的npm内的solc
        再使用npm install -g solc@0.6.0就可以了.
        当然solc-select也可以.
        下为演示步骤
        rm -rf /usr/local/lib/node_modules/solc
        sudo npm install -g solc@0.6.6

        再运行命令,即可生成 bin 文件 . 同理生成 abi 文件
        solcjs --bin uniswap.sol
        solcjs --abi uniswap.sol

        接下来使用abigen 即可生成 go 文件 .
        abigen --bin=uniswap_sol_IMeerkatRouter02.bin \
        --abi=uniswap_sol_IMeerkatRouter02.abi --pkg=Store --out=router.go

        那这个文件就是go 来链接链上Router合约,以及调用Router合约方法的文件
        同理生成factory合约文件...

-   使用go来与合约交互

        使用一个现有的很简单的项目来讲解,此项目可以在github.com/rzry/flashDeal 找到源码
        项目分层为下图.cmd 存放main.go  internal 存放主要实现.
        pkg 存放了我们上一步生成的一些go的文件.

        此项目是监控Swap池子余量,在池子最开始的时候抢跑
        (这个失败机率很大,已经被废弃了,请勿用于主网链上.)

        项目就是监控池子余量, 根据path 来发起swap的请求.
        我们主要来看授权 , 以及调用.

        func TestFlash(t *testing.T) {
            //建立 client 链接
        ci, err := ethclient.Dial("https://evm.cronos.org")
        if err != nil {
            return
        }
           //使用Erc20合约生成的go文件,链接这个token,获得Store
        pinstance, err := platform.NewStore(common.HexToAddress("0x66e428c3f67a68878562e79A0234c1F83c20870"), ci)
        if err != nil {
            return
        }
            //使用此Store来调用Allowance,查询有多少Approve数量
        in, err := pinstance.Allowance(nil, common.HexToAddress("0x545c2f7689bd45f8c9b78b6756f13580165e6d4"), common.HexToAddress("0x145677FC4d9b8F19B5D56d1820c48e0443049a30"))
        if err != nil {
            return
        }
        t.Logf(in.String())
            // 这就是最简单的一个交互,没有授权,一个只是view的请求
        }

        //删除一些无关代码.会在goroutine 获取到信号后,开始执行case
        for {
          select {
            case <-FasterDone:
              // 首先获取到auth
                auth, err := Auth(opt)
                if err != nil {
                    return
                }
                //在这里调用router的 swapExactTokensFroTokens,而第一个参数就是auth
                // 在上面view的请求中,我们可以直接传空,但是如果要付Gas,就要从此地址扣钱.
                tx, err := opt.RouterInstance.SwapExactTokensForTokens(auth,
                    pkg.ToEthers(opt.BuyAmount, opt.Decimal).BigInt(),
                    big.NewInt(0),
                    opt.Path,
                    auth.From,
                    big.NewInt(time.Now().Unix()+20*60))
                if err != nil {
                    return
                }

          func Auth(opt *options.Config) (auth *bind.TransactOpts, err error) {
            //获取Gas
            gas, err := opt.Ci.SuggestGasPrice(context.Background())
            if err != nil {
                return
            }
            //获取chainId
            chainId, err := opt.Ci.ChainID(context.Background())
            if err != nil {
                return
            }
            //根据私钥获取PrivateKey
            privateKey, err := crypto.HexToECDSA(opt.PrivateKey)
            if err != nil {
                return
            }
            //获取到auth
            auth, err = bind.NewKeyedTransactorWithChainID(privateKey, chainId)
            if err != nil {
                return
            }
            //获取到公钥
            publicKeyECDSA, ok := privateKey.Public().(*ecdsa.PublicKey)
            if !ok {
                return
            }
            //根据公钥获取from
            fromAddress := crypto.PubkeyToAddress(*publicKeyECDSA)
            //获取from的nonce
            nonce, err := opt.Ci.PendingNonceAt(context.Background(), fromAddress)
            if err != nil {
                return
            }
            //修改nonce
            auth.Nonce = big.NewInt(int64(nonce))
            //修改 msg.value
            auth.Value = big.NewInt(0) // in wei
            //修改 gaslimit
            auth.GasLimit = uint64(opt.GasLimit) // in units
            // 修改GasPrice
            auth.GasPrice = gas
            return
        }

        有了Auth,就可以请求Swap的接口了,有时候有一些需求,比如项目方需要给很多地址空投
        那使用go的线程池,你只用维护一个全局唯一累加的nonce,就可以很快的将所有交易全发出.
        (不过这个也要谨慎哦...)

-   使用go 来和Abi 交互

        前几天有小伙伴在群内问,如果没有开源的合约怎么调用之类的问题.
        恰好之前的写抢购公开Nft的脚本的时候有一部分代码重合.
        场景是要在很快的时间来根据Abi获取到Go能调用的函数.
        然后拼凑参数,监控目前请求的Gas,排序后,发起一笔交易.
        这部分代码比较多,我们只关注发起交易

        //也是删除掉无关紧要的代码后的结果,并不具备运行能力.
            func (d *Dynamic) NewTx(key string, new bool) (txHash *types.Transaction, err error) {
            // DealAbi 函数就是在根据合约地址拿到ABi后自动截取我所需要的那一段,然后返回拼凑的data
            // 具体的实现,我会贴在下面
            _, data := d.DealAbi()
            // 获取ChainId
            chain, err := d.GetChain()
            if err != nil {
                return
            }
            //获取nonce
            nonce, err := d.GetNonce(new, key)
            if err != nil {
                return
            }
            // 调用Eth 库 NewTx 来发起一笔新的交易
            tx := types.NewTx(&types.DynamicFeeTx{
                ChainID:   chain,
                Nonce:     nonce,
                // utils.toEthers 是将string转decimal扩大9位
                GasTipCap: utils.ToEthers(d.Gas, 9).BigInt(),
                GasFeeCap: utils.ToEthers(d.Gas, 9).BigInt(),
                Gas:       uint64(2150000),
                To:        d.GetTo(),
                Value:     utils.ToEthers(d.Value, 18).BigInt(),
                Data:      data,
            })
            //获取私钥
            private, err := d.getPrivate(key)
            if err != nil {
                return
            }
            // 签名
            tx, err = types.SignTx(tx, d.Getsigner(chain), private)
            if err != nil {
                return
            }
            // 发送到内存池中
            if err = d.Cc.SendTransaction(context.Background(), tx); err != nil {
                return
            }
            return tx, err
        }

            //此为处理 abi的函数
            func dealAbi(abis string, inputs []string) (method abi.Method, data []byte) {
               //定义pack的数据类型
               u256, _ := abi.NewType("uint256", "", nil)
               u8, _ := abi.NewType("u8", "", nil)
               addr, _ := abi.NewType("address", "", nil)
               byteslic, _ := abi.NewType("bytes32[]", "", nil)
               newType, _ := abi.NewType("bytes", "", nil)
               //将string 按 " 分割
               x := strings.Split(abis, "\"")
               var (
                   m      string
                   params []string
                   ispay  bool
               )
               for k, v := range x {
                   if v == "internalType" {
                       params = append(params, x[k+2])
                       continue
                   }
                   if v == "name" {
                       m = x[k+2]
                       continue
                   }

                                       if v == "stateMutability" && x[k+2] == "payable" {
                       ispay = true
                   }
               }
               if len(m) == 0 {
                   return
               }
               if len(params) != len(inputs) {
                   return
               }
               // 一顿遍历后获得了一个params 代表有多少个参数
               var input []abi.Argument
               // 遍历所有参数后 append到 数组中
               var packinput []interface{}
               for k, param := range params {
                   switch param {
                   case "uint256":
                       input = append(input, abi.Argument{
                           Type: u256,
                       })
                       d, err := decimal.NewFromString(inputs[k])
                       if err != nil {
                           return
                       }
                       packinput = append(packinput, d.BigInt())
                   case "uint8":
                       input = append(input, abi.Argument{
                           Type: u8,
                       })
                       d, err := decimal.NewFromString(inputs[k])
                       if err != nil {
                           return
                       }
                       packinput = append(packinput, d.BigInt())
                   case "address":
                       input = append(input, abi.Argument{
                           Type: addr,
                       })
                       packinput = append(packinput, common.HexToAddress(inputs[k]))
                   case "bytes32[]":
                       input = append(input, abi.Argument{
                           Type: byteslic,
                       })
                       packinput = append(packinput, inputs[k])
                   case "bytes":
                       input = append(input, abi.Argument{
                           Type: newType,
                       })
                       packinput = append(packinput, inputs[k])
                   }
               }
               // 调用NewMethod 函数, 来 构建我们请求的函数.
               method = abi.NewMethod(m, m, abi.Function, "", false, ispay, input, nil)
               // 再将inpit数组 pack起来
               data, err := method.Inputs.Pack(packinput...)
               if err != nil {
                   return
               }
               //再将Method.Sig部分于 data拼起来,就是我们newTx时候的data了
               data = bytesCombine(crypto.Keccak256([]byte(method.Sig))[:4], data)
               return
           }
        func bytesCombine(b ...[]byte) []byte {
             length := len(b)
             s := make([][]byte, length)
             for index := 0; index < length; index++ {
               s[index] = b[index]
             }
             sep := []byte("")
             return bytes.Join(s, sep)
         }


<a id="orgd23bcf9"></a>

# 厚积薄发

    在可以使用go 来调用合约后,可以在链下进行很多操作.
    比如三明治机器人,闪电贷机器人,抢购Nft,等等都可以操作.
    但是链下数据对比链上,以及每条链内存池,以及上链时间的变化都各有千秋.
    路漫漫其修远兮.吾将上下而求索.

